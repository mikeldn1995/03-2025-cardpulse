import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import type { Account, AccountCategory } from "@/types"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ── Currency Formatting ───────────────────────────────────

const currencyFormatters: Record<string, Intl.NumberFormat> = {}

export function formatCurrency(amount: number, currency = "GBP"): string {
  if (!currencyFormatters[currency]) {
    currencyFormatters[currency] = new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  }
  return currencyFormatters[currency].format(amount)
}

export function formatCompact(amount: number, currency = "GBP"): string {
  const sym = currency === "GBP" ? "\u00a3" : currency === "EUR" ? "\u20ac" : "$"
  if (Math.abs(amount) >= 1000) {
    return `${sym}${(amount / 1000).toFixed(1)}k`
  }
  return formatCurrency(amount, currency)
}

// ── Account Helpers ───────────────────────────────────────

export function isDebtAccount(account: Account): boolean {
  const debtCategories: AccountCategory[] = ["credit_card", "loan", "mortgage"]
  return debtCategories.includes(account.category) || account.balance < 0
}

export function getEffectiveApr(account: Account): number {
  if (account.aprPromo != null && account.promoUntil) {
    const promoEnd = new Date(account.promoUntil)
    if (promoEnd > new Date()) return account.aprPromo
  }
  return account.aprRegular ?? 0
}

export function calcMinPayment(account: Account): number {
  const bal = Math.abs(account.balance)
  if (bal <= 0) return 0
  if (account.minPaymentOverride != null) return account.minPaymentOverride
  if (account.dd === "full") return bal
  if (account.dd === "custom") return account.ddAmount
  return Math.max(bal * 0.05, Math.min(25, bal))
}

export function categoryLabel(cat: AccountCategory): string {
  const labels: Record<AccountCategory, string> = {
    credit_card: "Credit Cards",
    current_account: "Current Accounts",
    savings: "Savings",
    isa: "ISAs",
    investment: "Investments",
    crypto: "Crypto",
    loan: "Loans",
    mortgage: "Mortgages",
  }
  return labels[cat] || cat
}

export function categoryIcon(cat: AccountCategory): string {
  const icons: Record<AccountCategory, string> = {
    credit_card: "CreditCard",
    current_account: "Wallet",
    savings: "PiggyBank",
    isa: "Shield",
    investment: "TrendingUp",
    crypto: "Bitcoin",
    loan: "HandCoins",
    mortgage: "Home",
  }
  return icons[cat] || "Wallet"
}

// ── Date Helpers ──────────────────────────────────────────

export function daysAgo(dateStr: string): number {
  const d = new Date(dateStr)
  const now = new Date()
  return Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))
}

export function isStale(dateStr: string | null, thresholdDays = 35): boolean {
  if (!dateStr) return true
  return daysAgo(dateStr) > thresholdDays
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

export function formatDateShort(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  })
}

export function getGreeting(name: string): string {
  const h = new Date().getHours()
  if (h < 12) return `Good morning, ${name}`
  if (h < 18) return `Good afternoon, ${name}`
  return `Good evening, ${name}`
}

// ── Logo Helper ───────────────────────────────────────────

export function getLogoUrl(domain: string | null): string | null {
  if (!domain) return null
  return `https://logo.clearbit.com/${domain}`
}

export function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
}

const institutionColors: Record<string, string> = {
  barclays: "#00aeef",
  hsbc: "#db0011",
  lloyds: "#006a4d",
  natwest: "#42145f",
  halifax: "#004b8d",
  santander: "#ec0000",
  nationwide: "#003d6a",
  monzo: "#ff5c3a",
  starling: "#7433ff",
  revolut: "#0075eb",
  wise: "#9fe870",
  amex: "#006fcf",
  "american express": "#006fcf",
  chase: "#117aca",
  etoro: "#69c53e",
  "virgin money": "#e10a0a",
  "capital one": "#d03027",
  tesco: "#00539f",
  mbna: "#d4a843",
}

export function getInstitutionColor(institution: string): string {
  const key = institution.toLowerCase()
  for (const [name, color] of Object.entries(institutionColors)) {
    if (key.includes(name)) return color
  }
  let hash = 0
  for (let i = 0; i < institution.length; i++) {
    hash = institution.charCodeAt(i) + ((hash << 5) - hash)
  }
  const h = Math.abs(hash) % 360
  return `hsl(${h}, 50%, 50%)`
}

// ── Alerts ────────────────────────────────────────────────

export function getAccountAlerts(account: Account): string[] {
  const alerts: string[] = []

  if (isStale(account.lastStatementDate)) alerts.push("stale-data")

  if (account.category === "credit_card" && account.creditLimit) {
    const util = (Math.abs(account.balance) / account.creditLimit) * 100
    if (util >= 75) alerts.push("high-util")
  }

  if (account.balance < 0 && account.category === "current_account") {
    alerts.push("overdrawn")
  }

  if (isDebtAccount(account) && account.dd === "none" && Math.abs(account.balance) > 0) {
    alerts.push("no-dd")
  }

  if (account.aprPromo != null && account.promoUntil) {
    const daysToExpiry = (new Date(account.promoUntil).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    if (daysToExpiry > 0 && daysToExpiry <= 30) alerts.push("promo-expiring")
  }

  return alerts
}
