import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { CreditCard, MonthlyRecord } from "@/types/card"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const SYMBOLS: Record<string, string> = { GBP: "\u00a3", USD: "$", EUR: "\u20ac" }

export function fmt(n: number, currency: string = "GBP") {
  return SYMBOLS[currency] + n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function fmtShort(n: number, currency: string = "GBP") {
  return SYMBOLS[currency] + Math.round(n).toLocaleString("en-GB")
}

export function currencySymbol(currency: string) {
  return SYMBOLS[currency] || "\u00a3"
}

export function getEffectiveAPR(card: CreditCard): number {
  if (card.aprPromo !== null && card.promoUntil) {
    if (new Date(card.promoUntil) > new Date()) return card.aprPromo
  }
  return card.aprRegular
}

/** Get the current balance of a card.
 *  If there are monthly records, use the last one's closingBalance.
 *  Otherwise, fall back to openingBalance.
 */
export function getBalance(card: CreditCard): number {
  if (card.monthlyRecords.length === 0) return card.openingBalance
  const sorted = [...card.monthlyRecords].sort((a, b) => a.month.localeCompare(b.month))
  return sorted[sorted.length - 1].closingBalance
}

/** Get opening balance for a specific month (previous month's closing or card opening) */
export function getOpeningBalanceForMonth(card: CreditCard, month: string): number {
  const sorted = [...card.monthlyRecords]
    .filter(r => r.month < month)
    .sort((a, b) => a.month.localeCompare(b.month))
  if (sorted.length === 0) return card.openingBalance
  return sorted[sorted.length - 1].closingBalance
}

/** Derive interest from a monthly record:
 *  interest = closingBalance - openingBalance + credits - debits
 *  If the result is negative or nonsensical, fall back to APR-based estimate.
 */
export function deriveInterest(card: CreditCard, record: MonthlyRecord): number {
  const opening = getOpeningBalanceForMonth(card, record.month)
  const derived = record.closingBalance - opening + record.credits - record.debits
  if (derived >= 0) return Math.round(derived * 100) / 100
  // Fallback: APR-based
  return estimateInterest(opening, card)
}

/** Estimate interest based on APR */
export function estimateInterest(balance: number, card: CreditCard): number {
  if (balance <= 0) return 0
  const apr = getEffectiveAPR(card)
  return Math.round(balance * (apr / 100 / 12) * 100) / 100
}

/** Compute closing balance from opening + debits - credits + interest */
export function computeClosingBalance(opening: number, debits: number, credits: number, interest: number): number {
  return Math.round((opening + debits - credits + interest) * 100) / 100
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
  m++
  if (m > 12) { m = 1; y++ }
  while (`${y}-${String(m).padStart(2, "0")}` <= cm) {
    months.push(`${y}-${String(m).padStart(2, "0")}`)
    m++
    if (m > 12) { m = 1; y++ }
  }
  return months
}

/** Returns months that should have records but don't */
export function getMissingMonths(card: CreditCard): string[] {
  const expected = getExpectedMonths(card)
  const have = new Set(card.monthlyRecords.map(r => r.month))
  return expected.filter(m => !have.has(m))
}

export function isMissingRecentRecord(card: CreditCard): boolean {
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

export function formatDate(dateStr: string | null): string {
  if (!dateStr) return "\u2014"
  return new Date(dateStr).toLocaleDateString("en-GB", { month: "short", year: "numeric" })
}

export function getGreeting(name: string): string {
  const h = new Date().getHours()
  if (h < 12) return `Good morning, ${name}`
  if (h < 18) return `Good afternoon, ${name}`
  return `Good evening, ${name}`
}

/** Issuer color accents for visual differentiation */
const ISSUER_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  "amex": { bg: "bg-blue-500/10", text: "text-blue-600 dark:text-blue-400", border: "border-blue-500/20" },
  "american express": { bg: "bg-blue-500/10", text: "text-blue-600 dark:text-blue-400", border: "border-blue-500/20" },
  "barclays": { bg: "bg-teal-500/10", text: "text-teal-600 dark:text-teal-400", border: "border-teal-500/20" },
  "barclaycard": { bg: "bg-teal-500/10", text: "text-teal-600 dark:text-teal-400", border: "border-teal-500/20" },
  "hsbc": { bg: "bg-red-500/10", text: "text-red-600 dark:text-red-400", border: "border-red-500/20" },
  "lloyds": { bg: "bg-green-500/10", text: "text-green-600 dark:text-green-400", border: "border-green-500/20" },
  "natwest": { bg: "bg-purple-500/10", text: "text-purple-600 dark:text-purple-400", border: "border-purple-500/20" },
  "nationwide": { bg: "bg-indigo-500/10", text: "text-indigo-600 dark:text-indigo-400", border: "border-indigo-500/20" },
  "virgin": { bg: "bg-rose-500/10", text: "text-rose-600 dark:text-rose-400", border: "border-rose-500/20" },
  "virgin money": { bg: "bg-rose-500/10", text: "text-rose-600 dark:text-rose-400", border: "border-rose-500/20" },
  "monzo": { bg: "bg-orange-500/10", text: "text-orange-600 dark:text-orange-400", border: "border-orange-500/20" },
  "starling": { bg: "bg-cyan-500/10", text: "text-cyan-600 dark:text-cyan-400", border: "border-cyan-500/20" },
  "capital one": { bg: "bg-red-500/10", text: "text-red-600 dark:text-red-400", border: "border-red-500/20" },
  "chase": { bg: "bg-blue-600/10", text: "text-blue-700 dark:text-blue-300", border: "border-blue-600/20" },
  "halifax": { bg: "bg-sky-500/10", text: "text-sky-600 dark:text-sky-400", border: "border-sky-500/20" },
  "mbna": { bg: "bg-amber-500/10", text: "text-amber-600 dark:text-amber-400", border: "border-amber-500/20" },
  "sainsburys": { bg: "bg-orange-500/10", text: "text-orange-600 dark:text-orange-400", border: "border-orange-500/20" },
  "tesco": { bg: "bg-blue-500/10", text: "text-blue-600 dark:text-blue-400", border: "border-blue-500/20" },
  "mastercard": { bg: "bg-orange-500/10", text: "text-orange-600 dark:text-orange-400", border: "border-orange-500/20" },
  "visa": { bg: "bg-blue-500/10", text: "text-blue-600 dark:text-blue-400", border: "border-blue-500/20" },
}

const DEFAULT_ISSUER_COLOR = { bg: "bg-foreground/5", text: "text-foreground/70", border: "border-foreground/10" }

export function getIssuerColor(issuer: string): { bg: string; text: string; border: string } {
  const key = issuer.toLowerCase().trim()
  return ISSUER_COLORS[key] || DEFAULT_ISSUER_COLOR
}
