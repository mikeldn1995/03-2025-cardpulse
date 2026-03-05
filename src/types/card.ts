export interface CreditCard {
  id: number
  issuer: string
  last4: string
  fullNumber: string
  balance: number
  limit: number
  aprRegular: number
  aprPromo: number | null
  promoUntil: string | null // ISO date string
  dd: "minimum" | "custom" | "none"
  ddAmount: number
  address: string
  paymentDay: number // 1-28
}

export interface AppState {
  loggedIn: boolean
  loginExpiry: number | null
  utilThreshold: number
  currency: "GBP" | "USD" | "EUR"
  theme: "system" | "light" | "dark"
  cards: CreditCard[]
  forecastMonthly: number
}
