export interface MonthlyRecord {
  month: string // "YYYY-MM" — the statement period this record covers
  debits: number // total spending (charges to the card)
  credits: number // total payments (paid off the card)
  interest: number // auto-derived from balance delta, or APR-based estimate
  closingBalance: number // actual balance at end of period (TrueLayer snapshot or computed)
  source: "truelayer" | "manual"
}

export interface CreditCard {
  id: number
  issuer: string
  last4: string
  openingBalance: number // balance before any tracked records
  openingMonth: string // "YYYY-MM" — the month the opening balance is as of
  limit: number
  aprRegular: number
  aprPromo: number | null
  promoUntil: string | null // ISO date string
  dd: "minimum" | "custom" | "full" | "none"
  ddAmount: number
  paymentDay: number // 1-28
  statementDay: number // 1-28, day the statement cycle closes
  source: "truelayer" | "manual" // how this card was added
  tlAccountId: string | null // TrueLayer account ID for connected cards
  minPaymentOverride: number | null // user override for min payment calculation
  monthlyRecords: MonthlyRecord[]
}

export interface AppState {
  loggedIn: boolean
  loginExpiry: number | null
  userName: string
  userEmail: string
  utilThreshold: number
  currency: "GBP" | "USD" | "EUR"
  theme: "system" | "light" | "dark"
  cards: CreditCard[]
  forecastMonthly: number
  onboarded: boolean
}
