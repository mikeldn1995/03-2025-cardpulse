import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { accounts, transactions, balanceSnapshots } from "@/db/schema"
import { eq, and, sql } from "drizzle-orm"
import { getSession } from "@/lib/auth"
import type { ParsedStatement } from "@/types"

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const userId = session.user.id

  const body = await req.json()
  const statements: ParsedStatement[] = body.statements

  if (!statements || !Array.isArray(statements) || statements.length === 0) {
    return NextResponse.json({ error: "No statements provided" }, { status: 400 })
  }

  const batchId = `upload_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
  const results: { institution: string; last4: string; accountId: number; transactionsInserted: number; snapshotCreated: boolean }[] = []

  for (const stmt of statements) {
    try {
      // Try to match existing account by institution + last4
      let accountId: number

      const existingAccounts = await db
        .select()
        .from(accounts)
        .where(
          and(
            eq(accounts.userId, userId),
            eq(accounts.institution, stmt.institution),
            eq(accounts.last4, stmt.last4)
          )
        )
        .limit(1)

      if (existingAccounts.length > 0) {
        accountId = existingAccounts[0].id

        // Update account with latest statement data
        await db
          .update(accounts)
          .set({
            balance: stmt.balance,
            creditLimit: stmt.creditLimit ?? existingAccounts[0].creditLimit,
            interestCharged: stmt.interestCharged,
            minimumPayment: stmt.minimumPayment,
            paymentDueDate: stmt.paymentDueDate,
            lastStatementDate: stmt.statementDate,
            balanceUpdatedAt: new Date(),
            institutionDomain: stmt.institutionDomain ?? existingAccounts[0].institutionDomain,
            accountName: stmt.accountName || existingAccounts[0].accountName,
            aprRegular: stmt.aprDetected ?? existingAccounts[0].aprRegular,
          })
          .where(eq(accounts.id, accountId))
      } else {
        // Create new account
        const [newAccount] = await db
          .insert(accounts)
          .values({
            userId,
            institution: stmt.institution,
            institutionDomain: stmt.institutionDomain,
            accountName: stmt.accountName,
            category: stmt.category,
            last4: stmt.last4,
            currency: stmt.currency,
            balance: stmt.balance,
            creditLimit: stmt.creditLimit,
            interestCharged: stmt.interestCharged,
            minimumPayment: stmt.minimumPayment,
            paymentDueDate: stmt.paymentDueDate,
            lastStatementDate: stmt.statementDate,
            aprRegular: stmt.aprDetected,
            balanceUpdatedAt: new Date(),
          })
          .returning()

        accountId = newAccount.id
      }

      // Smart merge: delete overlapping statement transactions for this account in the statement period
      if (stmt.statementPeriodStart && stmt.statementPeriodEnd && stmt.transactions.length > 0) {
        await db.execute(
          sql`DELETE FROM transactions
              WHERE account_id = ${accountId}
              AND user_id = ${userId}
              AND source = 'statement'
              AND date >= ${stmt.statementPeriodStart}
              AND date <= ${stmt.statementPeriodEnd}`
        )
      }

      // Insert transactions
      let transactionsInserted = 0
      if (stmt.transactions.length > 0) {
        const txValues = stmt.transactions.map((t) => ({
          accountId,
          userId,
          date: t.date,
          description: t.description,
          amount: t.amount,
          category: t.category,
          categoryConfidence: t.categoryConfidence,
          source: "statement" as const,
          statementId: batchId,
          isTransfer: false,
          needsReview: t.categoryConfidence < 0.6,
        }))

        await db.insert(transactions).values(txValues)
        transactionsInserted = txValues.length
      }

      // Create balance snapshot
      let snapshotCreated = false
      await db.insert(balanceSnapshots).values({
        accountId,
        date: stmt.statementDate,
        balance: stmt.balance,
        creditLimit: stmt.creditLimit,
        interestCharged: stmt.interestCharged,
        minimumPayment: stmt.minimumPayment,
        paymentDueDate: stmt.paymentDueDate,
        statementPeriodStart: stmt.statementPeriodStart,
        statementPeriodEnd: stmt.statementPeriodEnd,
        source: "statement",
      })
      snapshotCreated = true

      results.push({
        institution: stmt.institution,
        last4: stmt.last4,
        accountId,
        transactionsInserted,
        snapshotCreated,
      })
    } catch (err: any) {
      results.push({
        institution: stmt.institution,
        last4: stmt.last4,
        accountId: 0,
        transactionsInserted: 0,
        snapshotCreated: false,
      })
    }
  }

  return NextResponse.json({ batchId, results })
}
