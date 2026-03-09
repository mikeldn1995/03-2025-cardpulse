import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { accounts, transactions, balanceSnapshots } from "@/db/schema"
import { eq, and } from "drizzle-orm"
import { getSession } from "@/lib/auth"

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const userId = session.user.id

  const result = await db
    .select()
    .from(accounts)
    .where(eq(accounts.userId, userId))

  return NextResponse.json(result)
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const userId = session.user.id

  const body = await req.json()

  const [account] = await db
    .insert(accounts)
    .values({
      userId,
      institution: body.institution,
      institutionDomain: body.institutionDomain || null,
      accountName: body.accountName || "",
      category: body.category,
      last4: body.last4 || "",
      currency: body.currency || "GBP",
      balance: body.balance ?? 0,
      creditLimit: body.creditLimit ?? null,
      overdraftLimit: body.overdraftLimit ?? null,
      aprRegular: body.aprRegular ?? null,
      aprPromo: body.aprPromo ?? null,
      promoUntil: body.promoUntil ?? null,
      minPaymentOverride: body.minPaymentOverride ?? null,
      dd: body.dd || "none",
      ddAmount: body.ddAmount ?? 0,
      paymentDay: body.paymentDay ?? null,
      statementDay: body.statementDay ?? null,
      interestCharged: body.interestCharged ?? null,
      minimumPayment: body.minimumPayment ?? null,
      paymentDueDate: body.paymentDueDate ?? null,
      lastStatementDate: body.lastStatementDate ?? null,
      balanceUpdatedAt: body.balance != null ? new Date() : null,
    })
    .returning()

  return NextResponse.json(account, { status: 201 })
}

export async function PUT(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const userId = session.user.id

  const body = await req.json()
  if (!body.id) return NextResponse.json({ error: "Missing account id" }, { status: 400 })

  // Verify ownership
  const existing = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.id, body.id), eq(accounts.userId, userId)))
    .limit(1)

  if (existing.length === 0) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 })
  }

  const { id, ...updates } = body
  // Remove fields that shouldn't be updated directly
  delete updates.userId
  delete updates.createdAt

  const [updated] = await db
    .update(accounts)
    .set(updates)
    .where(and(eq(accounts.id, id), eq(accounts.userId, userId)))
    .returning()

  return NextResponse.json(updated)
}

export async function DELETE(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const userId = session.user.id

  const { searchParams } = new URL(req.url)
  const id = Number(searchParams.get("id"))
  if (!id) return NextResponse.json({ error: "Missing account id" }, { status: 400 })

  // Verify ownership
  const existing = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.id, id), eq(accounts.userId, userId)))
    .limit(1)

  if (existing.length === 0) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 })
  }

  // Cascade delete: transactions and balance snapshots (handled by DB onDelete cascade)
  await db
    .delete(accounts)
    .where(and(eq(accounts.id, id), eq(accounts.userId, userId)))

  return NextResponse.json({ success: true })
}
