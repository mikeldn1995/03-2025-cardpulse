import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { transactions, categoryCorrectionRules, accounts } from "@/db/schema"
import { eq, and, desc, gte, lte, sql } from "drizzle-orm"
import { getSession } from "@/lib/auth"

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const userId = session.user.id

  const { searchParams } = new URL(req.url)
  const accountId = searchParams.get("accountId")
  const category = searchParams.get("category")
  const dateFrom = searchParams.get("dateFrom")
  const dateTo = searchParams.get("dateTo")
  const limit = Number(searchParams.get("limit")) || 100
  const offset = Number(searchParams.get("offset")) || 0

  const conditions = [eq(transactions.userId, userId)]

  if (accountId) conditions.push(eq(transactions.accountId, Number(accountId)))
  if (category) conditions.push(eq(transactions.category, category))
  if (dateFrom) conditions.push(gte(transactions.date, dateFrom))
  if (dateTo) conditions.push(lte(transactions.date, dateTo))

  const result = await db
    .select()
    .from(transactions)
    .where(and(...conditions))
    .orderBy(desc(transactions.date), desc(transactions.id))
    .limit(limit)
    .offset(offset)

  return NextResponse.json(result)
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const userId = session.user.id

  const body = await req.json()

  if (!body.accountId || !body.date || !body.description || body.amount == null) {
    return NextResponse.json({ error: "Missing required fields: accountId, date, description, amount" }, { status: 400 })
  }

  // Verify account ownership
  const account = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.id, body.accountId), eq(accounts.userId, userId)))
    .limit(1)

  if (account.length === 0) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 })
  }

  const [transaction] = await db
    .insert(transactions)
    .values({
      accountId: body.accountId,
      userId,
      date: body.date,
      description: body.description,
      amount: body.amount,
      category: body.category || "Uncategorised",
      categoryConfidence: body.categoryConfidence ?? null,
      source: "manual",
      isTransfer: body.isTransfer ?? false,
      linkedTransactionId: body.linkedTransactionId ?? null,
      needsReview: false,
    })
    .returning()

  return NextResponse.json(transaction, { status: 201 })
}

export async function PUT(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const userId = session.user.id

  const body = await req.json()
  if (!body.id) return NextResponse.json({ error: "Missing transaction id" }, { status: 400 })

  // Verify ownership
  const existing = await db
    .select()
    .from(transactions)
    .where(and(eq(transactions.id, body.id), eq(transactions.userId, userId)))
    .limit(1)

  if (existing.length === 0) {
    return NextResponse.json({ error: "Transaction not found" }, { status: 404 })
  }

  const oldTransaction = existing[0]

  // If category changed, save a correction rule for AI learning
  if (body.category && body.category !== oldTransaction.category) {
    await db.insert(categoryCorrectionRules).values({
      userId,
      descriptionPattern: oldTransaction.description,
      fromCategory: oldTransaction.category,
      toCategory: body.category,
    })
  }

  const { id, ...updates } = body
  delete updates.userId
  delete updates.createdAt
  delete updates.accountId // Don't allow changing account

  const [updated] = await db
    .update(transactions)
    .set(updates)
    .where(and(eq(transactions.id, id), eq(transactions.userId, userId)))
    .returning()

  return NextResponse.json(updated)
}

export async function DELETE(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const userId = session.user.id

  const { searchParams } = new URL(req.url)
  const id = Number(searchParams.get("id"))
  if (!id) return NextResponse.json({ error: "Missing transaction id" }, { status: 400 })

  const existing = await db
    .select()
    .from(transactions)
    .where(and(eq(transactions.id, id), eq(transactions.userId, userId)))
    .limit(1)

  if (existing.length === 0) {
    return NextResponse.json({ error: "Transaction not found" }, { status: 404 })
  }

  await db
    .delete(transactions)
    .where(and(eq(transactions.id, id), eq(transactions.userId, userId)))

  return NextResponse.json({ success: true })
}
