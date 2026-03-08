import { NextResponse } from "next/server"
import { db } from "@/db"
import { truelayerConnections, cards, monthlyRecords } from "@/db/schema"
import { eq, and } from "drizzle-orm"
import { fetchCards, fetchCardBalance, refreshAccessToken } from "@/lib/truelayer"

/**
 * POST: Take statement day snapshots for connected cards.
 * Called by:
 * 1. Cron job (daily) — checks all users' connected cards
 * 2. App-open fallback — checks the current user's cards
 *
 * For each connected card whose statement day matches today (or was missed),
 * saves a monthly record with the TrueLayer balance as the closing balance.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const userId = body.userId as number | undefined // Optional: specific user
  const today = new Date()
  const currentDay = today.getDate()
  const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`

  // Get connections to process
  const connections = userId
    ? await db.select().from(truelayerConnections).where(eq(truelayerConnections.userId, userId))
    : await db.select().from(truelayerConnections)

  const results: any[] = []

  for (const conn of connections) {
    let accessToken = conn.accessToken

    // Proactively refresh token if within 24h of expiry
    if (new Date(conn.expiresAt).getTime() - Date.now() < 24 * 60 * 60 * 1000) {
      try {
        const tokens = await refreshAccessToken(conn.refreshToken)
        accessToken = tokens.access_token
        await db.update(truelayerConnections).set({
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        }).where(eq(truelayerConnections.id, conn.id))
      } catch {
        // Token expired — revert cards to manual, remove connection
        await db.delete(truelayerConnections).where(eq(truelayerConnections.id, conn.id))
        await db.update(cards).set({ source: "manual" }).where(eq(cards.userId, conn.userId))
        results.push({ userId: conn.userId, error: "token_expired_reverted" })
        continue
      }
    }

    // Get this user's connected cards
    const userCards = await db.select().from(cards).where(
      and(eq(cards.userId, conn.userId), eq(cards.source, "truelayer"))
    )

    for (const card of userCards) {
      // Check if today is the statement day (or if we missed it — fallback)
      const isStatementDay = currentDay === card.statementDay

      // Check if we already have a record for this month
      const existingRecords = await db.select().from(monthlyRecords).where(
        and(eq(monthlyRecords.cardId, card.id), eq(monthlyRecords.month, currentMonth))
      )

      // Skip if: not statement day AND we already have a record, OR not statement day and no fallback needed
      if (!isStatementDay && existingRecords.length > 0) continue

      // For app-open fallback: check if the previous month is missing
      const prevDate = new Date(today.getFullYear(), today.getMonth() - 1, 1)
      const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`

      // Only snapshot if it's statement day OR previous month is missing
      const prevRecords = await db.select().from(monthlyRecords).where(
        and(eq(monthlyRecords.cardId, card.id), eq(monthlyRecords.month, prevMonth))
      )

      const shouldSnapshot = isStatementDay || (prevRecords.length === 0 && currentDay > card.statementDay)

      if (!shouldSnapshot) continue

      // Fetch live balance
      try {
        const tlCards = await fetchCards(accessToken)
        const matchedTl = tlCards.find(tc =>
          (card.tlAccountId && tc.account_id === card.tlAccountId) ||
          tc.partial_card_number?.endsWith(card.last4)
        )

        if (!matchedTl) continue

        const balance = await fetchCardBalance(accessToken, matchedTl.account_id)
        if (!balance) continue

        const snapshotMonth = isStatementDay ? currentMonth : prevMonth

        // Check if record already exists for this month
        const existing = await db.select().from(monthlyRecords).where(
          and(eq(monthlyRecords.cardId, card.id), eq(monthlyRecords.month, snapshotMonth))
        )

        if (existing.length === 0) {
          await db.insert(monthlyRecords).values({
            cardId: card.id,
            month: snapshotMonth,
            debits: 0, // Will be derived from balance delta
            credits: 0,
            interest: 0, // Will be derived
            closingBalance: balance.current,
            source: "truelayer",
          })
          results.push({ cardId: card.id, month: snapshotMonth, balance: balance.current })
        }
      } catch (err: any) {
        results.push({ cardId: card.id, error: err.message })
      }
    }
  }

  return NextResponse.json({ ok: true, snapshots: results })
}
