import { NextResponse } from "next/server"
import { db } from "@/db"
import { truelayerConnections, cards } from "@/db/schema"
import { eq } from "drizzle-orm"
import { getSession } from "@/lib/auth"
import { fetchCards, fetchCardBalance, refreshAccessToken } from "@/lib/truelayer"

// GET: Fetch live balances from TrueLayer for all connected cards
export async function GET() {
  const result = await getSession()
  if (!result) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userId = result.user.id
  const connections = await db.select().from(truelayerConnections).where(eq(truelayerConnections.userId, userId))

  if (connections.length === 0) {
    return NextResponse.json({ connected: false, cards: [] })
  }

  let conn = connections[0]
  let accessToken = conn.accessToken

  // Proactively refresh token if within 24 hours of expiry (keeps connection alive for ~90 days)
  if (new Date(conn.expiresAt).getTime() - Date.now() < 24 * 60 * 60 * 1000) {
    try {
      const tokens = await refreshAccessToken(conn.refreshToken)
      accessToken = tokens.access_token
      await db.update(truelayerConnections).set({
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      }).where(eq(truelayerConnections.id, conn.id))
    } catch (err: any) {
      // Refresh failed — connection expired, revert connected cards to manual
      await db.delete(truelayerConnections).where(eq(truelayerConnections.id, conn.id))
      await db.update(cards).set({ source: "manual" }).where(eq(cards.userId, userId))
      return NextResponse.json({ connected: false, cards: [], expired: true, error: "Bank connection expired. Your cards are now manual. Reconnect anytime in Settings." })
    }
  }

  try {
    const tlCards = await fetchCards(accessToken)

    // Fetch balance for each card
    const cardsWithBalances = await Promise.all(
      tlCards.map(async (card) => {
        const balance = await fetchCardBalance(accessToken, card.account_id)
        return {
          accountId: card.account_id,
          displayName: card.display_name,
          cardNetwork: card.card_network,
          partialNumber: card.partial_card_number,
          currency: card.currency,
          balance: balance ? {
            current: balance.current,
            available: balance.available,
            creditLimit: balance.credit_limit,
            lastStatementBalance: balance.last_statement_balance,
            lastStatementDate: balance.last_statement_date,
            paymentDue: balance.payment_due,
            paymentDueDate: balance.payment_due_date,
          } : null,
        }
      })
    )

    return NextResponse.json({ connected: true, cards: cardsWithBalances })
  } catch (err: any) {
    console.error("TrueLayer fetch error:", err)
    return NextResponse.json({ connected: false, cards: [], error: err.message })
  }
}
