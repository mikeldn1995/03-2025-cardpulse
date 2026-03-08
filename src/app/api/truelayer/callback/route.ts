import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { truelayerConnections, cards } from "@/db/schema"
import { eq, and } from "drizzle-orm"
import { exchangeCode, fetchCards, fetchCardBalance } from "@/lib/truelayer"

// GET: TrueLayer redirects here after user authorizes
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get("code")
  const state = searchParams.get("state")
  const error = searchParams.get("error")

  if (error || !code || !state) {
    const errorDesc = searchParams.get("error_description") || "Authorization failed"
    return NextResponse.redirect(new URL(`/settings?tl_error=${encodeURIComponent(errorDesc)}`, req.url))
  }

  let userId: number
  try {
    const decoded = JSON.parse(Buffer.from(state, "base64url").toString())
    userId = decoded.userId
  } catch {
    return NextResponse.redirect(new URL("/settings?tl_error=Invalid+state", req.url))
  }

  try {
    const tokens = await exchangeCode(code)

    // Remove old connection for this user
    await db.delete(truelayerConnections).where(eq(truelayerConnections.userId, userId))

    // Store new connection
    await db.insert(truelayerConnections).values({
      userId,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
    })

    // Auto-import discovered cards
    try {
      const tlCards = await fetchCards(tokens.access_token)
      const existingCards = await db.select().from(cards).where(eq(cards.userId, userId))
      const existingLast4s = new Set(existingCards.map(c => c.last4))

      for (const tc of tlCards) {
        const last4 = tc.partial_card_number?.slice(-4) || ""
        if (!last4 || existingLast4s.has(last4)) continue

        const balance = await fetchCardBalance(tokens.access_token, tc.account_id)
        await db.insert(cards).values({
          userId,
          issuer: tc.display_name || tc.card_network || "Unknown",
          last4,
          openingBalance: balance?.current || 0,
          openingMonth: new Date().toISOString().substring(0, 7),
          creditLimit: balance?.credit_limit || 0,
          aprRegular: 0, // User needs to fill this in
          dd: "none",
          ddAmount: 0,
          paymentDay: 5,
          statementDay: 1,
          source: "truelayer",
          tlAccountId: tc.account_id,
        })
      }
    } catch (importErr) {
      console.error("Auto-import error:", importErr)
      // Non-fatal — connection was saved, cards can be imported later
    }

    return NextResponse.redirect(new URL("/settings?tl_connected=1", req.url))
  } catch (err: any) {
    console.error("TrueLayer callback error:", err)
    return NextResponse.redirect(new URL(`/settings?tl_error=${encodeURIComponent(err.message)}`, req.url))
  }
}
