import { NextRequest } from "next/server"
import { db } from "@/db"
import { users, accounts, transactions } from "@/db/schema"
import { eq, gte } from "drizzle-orm"
import { Resend } from "resend"
import { digestEmailHtml } from "@/lib/digest-email"

const resend = new Resend(process.env.RESEND_API_KEY)
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://cardpulse.app"

const DEBT_CATEGORIES = new Set([
  "credit_card",
  "loan",
  "mortgage",
])

export async function GET(req: NextRequest) {
  // Verify Vercel Cron secret
  if (req.headers.get("Authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 })
  }

  try {
    const allUsers = await db.select().from(users)
    let sent = 0

    // Date 7 days ago for weekly window
    const now = new Date()
    const weekAgo = new Date(now)
    weekAgo.setDate(weekAgo.getDate() - 7)
    const weekAgoStr = weekAgo.toISOString().split("T")[0]

    for (const user of allUsers) {
      // Fetch all accounts for this user
      const userAccounts = await db
        .select()
        .from(accounts)
        .where(eq(accounts.userId, user.id))

      if (userAccounts.length === 0) continue

      // Compute net worth and debt total
      let netWorth = 0
      let debtTotal = 0
      const accountSummaries: { institution: string; balance: number; change: number }[] = []

      // Fetch recent transactions for balance change approximation
      const recentTxns = await db
        .select()
        .from(transactions)
        .where(eq(transactions.userId, user.id))

      // Filter to last 7 days in application code (date is stored as text "YYYY-MM-DD")
      const weekTxns = recentTxns.filter((t) => t.date >= weekAgoStr)

      // Group transaction totals by account
      const txnByAccount = new Map<number, number>()
      for (const txn of weekTxns) {
        const prev = txnByAccount.get(txn.accountId) || 0
        txnByAccount.set(txn.accountId, prev + txn.amount)
      }

      for (const account of userAccounts) {
        const balance = account.balance
        netWorth += balance

        if (DEBT_CATEGORIES.has(account.category) && balance < 0) {
          debtTotal += Math.abs(balance)
        }

        // Change is the net transaction amount this week
        const change = txnByAccount.get(account.id) || 0

        accountSummaries.push({
          institution: `${account.institution}${account.accountName ? " – " + account.accountName : ""}`,
          balance,
          change,
        })
      }

      // Top spending categories (negative amounts = spending)
      const categoryTotals = new Map<string, number>()
      for (const txn of weekTxns) {
        if (txn.amount < 0 && !txn.isTransfer) {
          const prev = categoryTotals.get(txn.category) || 0
          categoryTotals.set(txn.category, prev + Math.abs(txn.amount))
        }
      }

      const topCategories = Array.from(categoryTotals.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, amount]) => ({ name, amount }))

      // Send digest email
      await resend.emails.send({
        from: "CardPulse <digest@cardpulse.app>",
        to: user.email,
        subject: "Your CardPulse Weekly Digest",
        html: digestEmailHtml({
          userName: user.name || "there",
          netWorth,
          debtTotal,
          accounts: accountSummaries,
          topCategories,
          appUrl: APP_URL,
        }),
      })
      sent++
    }

    return Response.json({ success: true, emailsSent: sent })
  } catch (error) {
    console.error("Digest cron failed:", error)
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
}
