import type { Account } from "@/types"
import { getEffectiveApr, calcMinPayment } from "./utils"

export interface ForecastPoint {
  month: number
  label: string
  totalDebt: number
  perAccount: Record<number, number>
}

export interface ForecastResult {
  minimum: ForecastPoint[]
  custom: ForecastPoint[]
  payoffMonthMinimum: number | null
  payoffMonthCustom: number | null
  totalInterestMinimum: number
  totalInterestCustom: number
  strategies: StrategyTip[]
}

export interface StrategyTip {
  title: string
  description: string
  savingsEstimate: number | null
}

export function generateForecast(
  debtAccounts: Account[],
  extraMonthly: number = 0,
  maxMonths: number = 60
): ForecastResult {
  if (debtAccounts.length === 0) {
    return {
      minimum: [], custom: [],
      payoffMonthMinimum: null, payoffMonthCustom: null,
      totalInterestMinimum: 0, totalInterestCustom: 0,
      strategies: [],
    }
  }

  const minimum = simulate(debtAccounts, 0, maxMonths)
  const custom = extraMonthly > 0 ? simulate(debtAccounts, extraMonthly, maxMonths) : minimum

  const totalInterestMinimum = calcTotalInterest(minimum, debtAccounts)
  const totalInterestCustom = extraMonthly > 0 ? calcTotalInterest(custom, debtAccounts) : totalInterestMinimum

  return {
    minimum,
    custom,
    payoffMonthMinimum: findPayoffMonth(minimum),
    payoffMonthCustom: extraMonthly > 0 ? findPayoffMonth(custom) : findPayoffMonth(minimum),
    totalInterestMinimum,
    totalInterestCustom,
    strategies: generateStrategies(debtAccounts, totalInterestMinimum, totalInterestCustom, extraMonthly),
  }
}

function simulate(accounts: Account[], extraMonthly: number, maxMonths: number): ForecastPoint[] {
  const balances = new Map<number, number>()
  accounts.forEach((a) => balances.set(a.id, Math.abs(a.balance)))

  const points: ForecastPoint[] = []
  const now = new Date()

  for (let m = 0; m <= maxMonths; m++) {
    const date = new Date(now.getFullYear(), now.getMonth() + m, 1)
    const label = date.toLocaleDateString("en-GB", { month: "short", year: "2-digit" })

    const perAccount: Record<number, number> = {}
    let totalDebt = 0
    for (const a of accounts) {
      const bal = balances.get(a.id) || 0
      perAccount[a.id] = bal
      totalDebt += bal
    }

    points.push({ month: m, label, totalDebt, perAccount })
    if (totalDebt <= 0.5) break

    // Sort by APR descending (avalanche)
    const sorted = [...accounts].sort((a, b) => getEffectiveApr(b) - getEffectiveApr(a))
    let extraLeft = extraMonthly

    for (const a of sorted) {
      let bal = balances.get(a.id) || 0
      if (bal <= 0) continue

      const monthlyRate = getEffectiveApr(a) / 100 / 12
      bal += bal * monthlyRate
      bal = Math.max(0, bal - calcMinPayment(a))
      balances.set(a.id, bal)
    }

    for (const a of sorted) {
      if (extraLeft <= 0) break
      let bal = balances.get(a.id) || 0
      if (bal <= 0) continue
      const payment = Math.min(extraLeft, bal)
      bal -= payment
      extraLeft -= payment
      balances.set(a.id, bal)
    }
  }

  return points
}

function findPayoffMonth(points: ForecastPoint[]): number | null {
  for (const p of points) {
    if (p.totalDebt <= 0.5) return p.month
  }
  return null
}

function calcTotalInterest(points: ForecastPoint[], accounts: Account[]): number {
  let total = 0
  for (let i = 1; i < points.length; i++) {
    for (const a of accounts) {
      const prevBal = points[i - 1].perAccount[a.id] || 0
      if (prevBal <= 0) continue
      total += prevBal * (getEffectiveApr(a) / 100 / 12)
    }
  }
  return Math.round(total * 100) / 100
}

function generateStrategies(
  accounts: Account[], interestMin: number, interestCustom: number, extra: number
): StrategyTip[] {
  const tips: StrategyTip[] = []

  const promoAccounts = accounts.filter((a) => a.aprPromo != null && a.promoUntil)
  if (promoAccounts.length > 0) {
    tips.push({
      title: "Use promo rates wisely",
      description: `You have ${promoAccounts.length} account(s) with promotional rates. Focus extra payments on high-APR debt while promos last.`,
      savingsEstimate: null,
    })
  }

  const sorted = [...accounts].sort((a, b) => getEffectiveApr(b) - getEffectiveApr(a))
  if (sorted.length > 1) {
    tips.push({
      title: "Avalanche method",
      description: `Pay minimums on all, extra towards ${sorted[0].institution} (${getEffectiveApr(sorted[0]).toFixed(1)}% APR) first.`,
      savingsEstimate: extra > 0 ? Math.round(interestMin - interestCustom) : null,
    })
  }

  if (extra > 0 && interestMin > interestCustom) {
    tips.push({
      title: "Extra payment impact",
      description: `Paying an extra ${extra}/month saves approximately in interest.`,
      savingsEstimate: Math.round(interestMin - interestCustom),
    })
  }

  return tips
}
