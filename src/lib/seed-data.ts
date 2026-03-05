import { CreditCard } from "@/types/card"
import cardsDb from "@/data/cards.json"

export const SEED_ADDRESSES: string[] = [
  cardsDb.defaultAddress,
]

export const SEED_CARDS: CreditCard[] = cardsDb.cards.map(c => ({
  id: c.id,
  issuer: c.issuer,
  last4: c.last4,
  fullNumber: c.fullNumber,
  openingBalance: c.openingBalance,
  openingMonth: c.openingMonth,
  limit: c.limit,
  aprRegular: c.aprRegular,
  aprPromo: c.aprPromo,
  promoUntil: c.promoUntil,
  dd: c.dd as CreditCard["dd"],
  ddAmount: c.ddAmount,
  address: cardsDb.defaultAddress,
  paymentDay: c.paymentDay,
  statements: [],
}))
