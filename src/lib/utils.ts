import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { CreditCard } from "@/types/card"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const SYMBOLS: Record<string, string> = { GBP: "£", USD: "$", EUR: "€" }

export function fmt(n: number, currency: string = "GBP") {
  return SYMBOLS[currency] + n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function fmtShort(n: number, currency: string = "GBP") {
  return SYMBOLS[currency] + Math.round(n).toLocaleString("en-GB")
}

export function currencySymbol(currency: string) {
  return SYMBOLS[currency] || "£"
}

export function getEffectiveAPR(card: CreditCard): number {
  if (card.aprPromo !== null && card.promoUntil) {
    if (new Date(card.promoUntil) > new Date()) return card.aprPromo
    // auto-expired — caller should mutate if needed
  }
  return card.aprRegular
}

export function getBalance(card: CreditCard): number {
  return card.statements.reduce(
    (bal, s) => bal + s.spent - s.paid + s.interest,
    card.openingBalance
  )
}

export function utilPercent(card: CreditCard): number {
  const bal = getBalance(card)
  return card.limit > 0 ? (bal / card.limit) * 100 : 0
}

export function currentMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

/** Returns all months from the month after openingMonth up to currentMonth */
export function getExpectedMonths(card: CreditCard): string[] {
  const cm = currentMonth()
  const months: string[] = []
  const [sy, sm] = card.openingMonth.split("-").map(Number)
  let y = sy, m = sm
  // Advance one month past opening (first expected statement month)
  m++
  if (m > 12) { m = 1; y++ }
  while (`${y}-${String(m).padStart(2, "0")}` <= cm) {
    months.push(`${y}-${String(m).padStart(2, "0")}`)
    m++
    if (m > 12) { m = 1; y++ }
  }
  return months
}

/** Returns months that should have statements but don't */
export function getMissingMonths(card: CreditCard): string[] {
  const expected = getExpectedMonths(card)
  const have = new Set(card.statements.map(s => s.month))
  return expected.filter(m => !have.has(m))
}

export function isMissingRecentStatement(card: CreditCard): boolean {
  return getMissingMonths(card).length > 0
}

export function utilColor(pct: number): string {
  if (pct < 30) return "text-success"
  if (pct < 50) return "text-warning"
  return "text-destructive"
}

export function utilBarColor(pct: number): string {
  if (pct < 30) return "bg-success"
  if (pct < 50) return "bg-warning"
  return "bg-destructive"
}

export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"]
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

export function maskNumber(num: string): string {
  return num.replace(/\d(?=.{4})/g, "•").replace(/•{4}/g, "••••")
}

export function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—"
  return new Date(dateStr).toLocaleDateString("en-GB", { month: "short", year: "numeric" })
}

export function getGreeting(name: string): string {
  const h = new Date().getHours()
  if (h < 12) return `Good morning, ${name}`
  if (h < 18) return `Good afternoon, ${name}`
  return `Good evening, ${name}`
}
