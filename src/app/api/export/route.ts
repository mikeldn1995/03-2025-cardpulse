import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { accounts, transactions } from "@/db/schema"
import { getSession } from "@/lib/auth"
import { eq, and, gte, lte } from "drizzle-orm"

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
  }

  const { searchParams } = req.nextUrl
  const format = searchParams.get("format") ?? "csv"
  const accountId = searchParams.get("accountId")
  const dateFrom = searchParams.get("dateFrom")
  const dateTo = searchParams.get("dateTo")

  if (format !== "csv" && format !== "json") {
    return NextResponse.json(
      { error: "Invalid format. Use 'csv' or 'json'." },
      { status: 400 },
    )
  }

  // Build transaction filters
  const filters = [eq(transactions.userId, session.user.id)]
  if (accountId) filters.push(eq(transactions.accountId, Number(accountId)))
  if (dateFrom) filters.push(gte(transactions.date, dateFrom))
  if (dateTo) filters.push(lte(transactions.date, dateTo))

  // Fetch accounts for this user (keyed by id for quick lookup)
  const userAccounts = await db
    .select()
    .from(accounts)
    .where(eq(accounts.userId, session.user.id))

  const accountMap = new Map(userAccounts.map((a) => [a.id, a]))

  // Fetch filtered transactions
  const rows = await db
    .select()
    .from(transactions)
    .where(and(...filters))
    .orderBy(transactions.date)

  // Build enriched rows
  const enriched = rows.map((tx) => {
    const acct = accountMap.get(tx.accountId)
    return {
      date: tx.date,
      account: acct
        ? `${acct.institution} ${acct.accountName}`.trim()
        : String(tx.accountId),
      description: tx.description,
      amount: tx.amount,
      category: tx.category,
      currency: acct?.currency ?? "GBP",
    }
  })

  // ── JSON ────────────────────────────────────────────────
  if (format === "json") {
    const timestamp = new Date().toISOString().slice(0, 10)
    return new NextResponse(JSON.stringify({ exportedAt: timestamp, transactions: enriched }, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="cardpulse-export-${timestamp}.json"`,
      },
    })
  }

  // ── CSV ─────────────────────────────────────────────────
  const csvHeaders = ["Date", "Account", "Description", "Amount", "Category", "Currency"]
  const csvRows = enriched.map((r) =>
    [
      r.date,
      csvEscape(r.account),
      csvEscape(r.description),
      r.amount.toFixed(2),
      csvEscape(r.category),
      r.currency,
    ].join(","),
  )

  const csv = [csvHeaders.join(","), ...csvRows].join("\n")
  const timestamp = new Date().toISOString().slice(0, 10)

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="cardpulse-export-${timestamp}.csv"`,
    },
  })
}

/** Escape a value for safe CSV inclusion */
function csvEscape(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}
