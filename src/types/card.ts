export interface StatementEntry {
  month: string // "YYYY-MM" — calendar month this statement covers
  spent: number
  paid: number
  interest: number
  source: "manual" | "upload"
}

export interface CreditCard {
  id: number
  issuer: string
  last4: string
  fullNumber: string
  openingBalance: number // balance before any tracked statements
  openingMonth: string // "YYYY-MM" — the month the opening balance is as of (statements expected from month after)
  limit: number
  aprRegular: number
  aprPromo: number | null
  promoUntil: string | null // ISO date string
  dd: "minimum" | "custom" | "none"
  ddAmount: number
  address: string
  paymentDay: number // 1-28
  statementDay: number // 1-28, day the statement cycle closes
  statements: StatementEntry[]
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
  addresses: string[]
}
