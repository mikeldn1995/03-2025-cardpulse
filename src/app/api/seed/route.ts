import { NextResponse } from "next/server"
import { db } from "@/db"
import { users, cards } from "@/db/schema"
import { eq } from "drizzle-orm"
import cardsDb from "@/data/cards.json"

export async function POST() {
  const email = "michael.gb@icloud.com"

  const existing = await db.select().from(users).where(eq(users.email, email)).limit(1)
  let userId: number

  if (existing.length > 0) {
    userId = existing[0].id
  } else {
    const [user] = await db.insert(users).values({
      email,
      name: "Michael",
      currency: "GBP",
      theme: "system",
      utilThreshold: 75,
      forecastMonthly: 200,
      onboarded: true,
    }).returning()
    userId = user.id
  }

  // Seed cards (skip if already seeded)
  const existingCards = await db.select().from(cards).where(eq(cards.userId, userId))
  if (existingCards.length === 0) {
    for (const c of cardsDb.cards) {
      await db.insert(cards).values({
        userId,
        issuer: c.issuer,
        last4: c.last4,
        openingBalance: c.openingBalance,
        openingMonth: c.openingMonth,
        creditLimit: c.limit,
        aprRegular: c.aprRegular,
        aprPromo: c.aprPromo,
        promoUntil: c.promoUntil,
        dd: c.dd,
        ddAmount: c.ddAmount,
        paymentDay: c.paymentDay,
        source: "manual",
      })
    }
  }

  return NextResponse.json({ ok: true, userId, cardsSeeded: cardsDb.cards.length })
}
