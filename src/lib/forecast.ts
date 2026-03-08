import { CreditCard } from "@/types/card"
import { getEffectiveAPR, getBalance } from "@/lib/utils"

export interface ForecastResult {
  months: number[]
  totalBals: number[]
  totalInterests: number[]
  paidOff: boolean
}

export interface ForecastData {
  custom: ForecastResult
  minimum: ForecastResult
  labels: string[]
  maxLen: number
  customMonthlyInt: number[]
  minimumMonthlyInt: number[]
  customPrincipal: number[]
}

/** Get average monthly debits and credits from recent records (up to 3 months) */
function getAverages(card: CreditCard): { avgDebits: number; avgCredits: number } {
  const sorted = [...card.monthlyRecords].sort((a, b) => b.month.localeCompare(a.month))
  const recent = sorted.slice(0, 3)
  if (recent.length === 0) return { avgDebits: 0, avgCredits: 0 }
  const avgDebits = recent.reduce((s, r) => s + r.debits, 0) / recent.length
  const avgCredits = recent.reduce((s, r) => s + r.credits, 0) / recent.length
  return { avgDebits, avgCredits }
}

function simulate(cards: CreditCard[], getPayment: (totalBal: number) => number): ForecastResult {
  const balances = cards.map(c => getBalance(c))
  const regularRates = cards.map(c => c.aprRegular / 100 / 12)
  const promoRates = cards.map(c => c.aprPromo !== null ? c.aprPromo / 100 / 12 : null)
  const promoExpiry = cards.map(c => c.promoUntil ? new Date(c.promoUntil) : null)
  const averages = cards.map(c => getAverages(c))
  const months: number[] = []
  const totalBals: number[] = []
  const totalInterests: number[] = []
  let cumInterest = 0
  const now = new Date()

  const MAX_MONTHS = 36
  for (let m = 1; m <= MAX_MONTHS; m++) {
    let totalB = balances.reduce((s, b) => s + b, 0)
    if (totalB <= 0) break

    const forecastDate = new Date(now.getFullYear(), now.getMonth() + m, 1)

    let monthInterest = 0
    for (let i = 0; i < balances.length; i++) {
      if (balances[i] <= 0) continue

      // Add projected spending (debits increase balance)
      balances[i] += averages[i].avgDebits

      // Calculate interest using APR
      const rate = (promoRates[i] !== null && promoExpiry[i] && forecastDate < promoExpiry[i]!)
        ? promoRates[i]! : regularRates[i]
      const interest = balances[i] * rate
      monthInterest += interest
      balances[i] += interest
    }

    // Apply payments
    const payment = getPayment(totalB)
    const currentTotal = balances.reduce((s, b) => s + Math.max(0, b), 0)
    const remaining = Math.min(payment, currentTotal)

    for (let i = 0; i < balances.length; i++) {
      if (balances[i] <= 0) continue
      const share = currentTotal > 0 ? balances[i] / currentTotal : 0
      const pay = Math.min(remaining * share, balances[i])
      balances[i] -= pay
    }

    cumInterest += monthInterest
    totalBals.push(balances.reduce((s, b) => s + Math.max(0, b), 0))
    totalInterests.push(cumInterest)
    months.push(m)

    if (balances.reduce((s, b) => s + b, 0) <= 0.5) break
  }

  const finalBal = balances.reduce((s, b) => s + b, 0)
  return { months, totalBals, totalInterests, paidOff: finalBal <= 0.5 }
}

export function computeForecast(cards: CreditCard[], monthlyPayment: number): ForecastData | null {
  const totalBal = cards.reduce((s, c) => s + getBalance(c), 0)
  if (totalBal <= 0) return null

  function minPayment(bal: number) {
    return Math.max(bal * 0.05, Math.min(25, bal))
  }

  const custom = simulate(cards, () => monthlyPayment)
  const minimum = simulate(cards, bal => minPayment(bal))

  const maxLen = Math.max(custom.months.length, minimum.months.length)
  const labels: string[] = []
  const now = new Date()
  for (let i = 0; i < maxLen; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + 1 + i, 1)
    labels.push(d.toLocaleDateString("en-GB", { month: "short", year: "2-digit" }))
  }

  while (custom.totalBals.length < maxLen) {
    custom.totalBals.push(0)
    custom.totalInterests.push(custom.totalInterests[custom.totalInterests.length - 1] || 0)
  }
  while (minimum.totalBals.length < maxLen) {
    minimum.totalBals.push(0)
    minimum.totalInterests.push(minimum.totalInterests[minimum.totalInterests.length - 1] || 0)
  }

  const customMonthlyInt = custom.totalInterests.map((v, i) => (i === 0 ? v : v - custom.totalInterests[i - 1]))
  const minimumMonthlyInt = minimum.totalInterests.map((v, i) => (i === 0 ? v : v - minimum.totalInterests[i - 1]))
  const customPrincipal = custom.totalBals.map((v, i) => {
    const prev = i === 0 ? totalBal : custom.totalBals[i - 1]
    return Math.max(0, prev - v)
  })

  return { custom, minimum, labels, maxLen, customMonthlyInt, minimumMonthlyInt, customPrincipal }
}
