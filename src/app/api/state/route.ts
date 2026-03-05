import { NextResponse } from "next/server"
import { db } from "@/db"
import { users, cards, statements, addresses } from "@/db/schema"
import { eq } from "drizzle-orm"
import { getSession } from "@/lib/auth"

// GET: Load full user state from DB
export async function GET() {
  const result = await getSession()
  if (!result) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userId = result.user.id
  const user = result.user
  const userCards = await db.select().from(cards).where(eq(cards.userId, userId))
  const userAddresses = await db.select().from(addresses).where(eq(addresses.userId, userId))

  // Load statements for each card
  const cardsWithStatements = await Promise.all(
    userCards.map(async (card) => {
      const cardStatements = await db.select().from(statements).where(eq(statements.cardId, card.id))
      return {
        id: card.id,
        issuer: card.issuer,
        last4: card.last4,
        fullNumber: card.fullNumber,
        openingBalance: card.openingBalance,
        openingMonth: card.openingMonth,
        limit: card.creditLimit,
        aprRegular: card.aprRegular,
        aprPromo: card.aprPromo,
        promoUntil: card.promoUntil,
        dd: card.dd,
        ddAmount: card.ddAmount,
        address: card.address,
        paymentDay: card.paymentDay,
        statements: cardStatements.map((s) => ({
          month: s.month,
          spent: s.spent,
          paid: s.paid,
          interest: s.interest,
          source: s.source,
        })),
      }
    })
  )

  return NextResponse.json({
    userName: user.name,
    userEmail: user.email,
    utilThreshold: user.utilThreshold,
    currency: user.currency,
    theme: user.theme,
    forecastMonthly: user.forecastMonthly,
    cards: cardsWithStatements,
    addresses: userAddresses.map((a) => a.address),
  })
}

// PUT: Save full user state to DB
export async function PUT(req: Request) {
  const result = await getSession()
  if (!result) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userId = result.user.id
  const body = await req.json()

  // Update user preferences
  await db.update(users).set({
    name: body.userName ?? result.user.name,
    currency: body.currency ?? result.user.currency,
    theme: body.theme ?? result.user.theme,
    utilThreshold: body.utilThreshold ?? result.user.utilThreshold,
    forecastMonthly: body.forecastMonthly ?? result.user.forecastMonthly,
  }).where(eq(users.id, userId))

  // Sync addresses
  if (body.addresses) {
    await db.delete(addresses).where(eq(addresses.userId, userId))
    for (const addr of body.addresses) {
      await db.insert(addresses).values({ userId, address: addr })
    }
  }

  // Sync cards
  if (body.cards) {
    // Get existing cards
    const existingCards = await db.select().from(cards).where(eq(cards.userId, userId))
    const existingIds = new Set(existingCards.map((c) => c.id))
    const incomingIds = new Set(body.cards.filter((c: any) => c.id).map((c: any) => c.id))

    // Delete removed cards
    for (const ec of existingCards) {
      if (!incomingIds.has(ec.id)) {
        await db.delete(statements).where(eq(statements.cardId, ec.id))
        await db.delete(cards).where(eq(cards.id, ec.id))
      }
    }

    // Upsert cards
    for (const card of body.cards) {
      if (card.id && existingIds.has(card.id)) {
        // Update existing card
        await db.update(cards).set({
          issuer: card.issuer,
          last4: card.last4,
          fullNumber: card.fullNumber,
          openingBalance: card.openingBalance,
          openingMonth: card.openingMonth,
          creditLimit: card.limit,
          aprRegular: card.aprRegular,
          aprPromo: card.aprPromo,
          promoUntil: card.promoUntil,
          dd: card.dd,
          ddAmount: card.ddAmount,
          address: card.address,
          paymentDay: card.paymentDay,
        }).where(eq(cards.id, card.id))

        // Replace statements
        await db.delete(statements).where(eq(statements.cardId, card.id))
        for (const st of card.statements || []) {
          await db.insert(statements).values({
            cardId: card.id,
            month: st.month,
            spent: st.spent,
            paid: st.paid,
            interest: st.interest,
            source: st.source || "manual",
          })
        }
      } else {
        // Insert new card
        const [newCard] = await db.insert(cards).values({
          userId,
          issuer: card.issuer,
          last4: card.last4 || "0000",
          fullNumber: card.fullNumber || "",
          openingBalance: card.openingBalance || 0,
          openingMonth: card.openingMonth || "2025-02",
          creditLimit: card.limit || 0,
          aprRegular: card.aprRegular || 0,
          aprPromo: card.aprPromo,
          promoUntil: card.promoUntil,
          dd: card.dd || "none",
          ddAmount: card.ddAmount || 0,
          address: card.address || "",
          paymentDay: card.paymentDay || 5,
        }).returning()

        for (const st of card.statements || []) {
          await db.insert(statements).values({
            cardId: newCard.id,
            month: st.month,
            spent: st.spent,
            paid: st.paid,
            interest: st.interest,
            source: st.source || "manual",
          })
        }
      }
    }
  }

  return NextResponse.json({ ok: true })
}
