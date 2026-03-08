import { NextResponse } from "next/server"
import { db } from "@/db"
import { truelayerConnections } from "@/db/schema"
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

  // Refresh token if expired or about to expire (5 min buffer)
  if (new Date(conn.expiresAt).getTime() - Date.now() < 5 * 60 * 1000) {
    try {
      const tokens = await refreshAccessToken(conn.refreshToken)
      accessToken = tokens.access_token
      await db.update(truelayerConnections).set({
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      }).where(eq(truelayerConnections.id, conn.id))
    } catch (err: any) {
      // Refresh failed — connection is stale, remove it
      await db.delete(truelayerConnections).where(eq(truelayerConnections.id, conn.id))
      return NextResponse.json({ connected: false, cards: [], error: "Connection expired, please reconnect." })
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
