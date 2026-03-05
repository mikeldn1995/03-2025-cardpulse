import { CreditCard } from "@/types/card"
import { getEffectiveAPR } from "@/lib/utils"

export interface ForecastResult {
  months: number[]
  totalBals: number[]
  totalInterests: number[]
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

function simulate(cards: CreditCard[], getPayment: (totalBal: number) => number): ForecastResult {
  const balances = cards.map(c => c.balance)
  const rates = cards.map(c => getEffectiveAPR(c) / 100 / 12)
  const months: number[] = []
  const totalBals: number[] = []
  const totalInterests: number[] = []
  let cumInterest = 0

  for (let m = 1; m <= 360; m++) {
    let totalB = balances.reduce((s, b) => s + b, 0)
    if (totalB <= 0) break

    let monthInterest = 0
    for (let i = 0; i < balances.length; i++) {
      const interest = balances[i] * rates[i]
      monthInterest += interest
      balances[i] += interest
    }

    const payment = getPayment(totalB)
    const currentTotal = balances.reduce((s, b) => s + b, 0)
    const remaining = Math.min(payment, currentTotal)

    for (let i = 0; i < balances.length; i++) {
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

  return { months, totalBals, totalInterests }
}

export function computeForecast(cards: CreditCard[], monthlyPayment: number): ForecastData | null {
  const totalBal = cards.reduce((s, c) => s + c.balance, 0)
  if (totalBal <= 0) return null

  function minPayment(bal: number) {
    return Math.max(bal * 0.02, Math.min(25, bal))
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

  // Pad shorter
  while (custom.totalBals.length < maxLen) {
    custom.totalBals.push(0)
    custom.totalInterests.push(custom.totalInterests[custom.totalInterests.length - 1] || 0)
  }
  while (minimum.totalBals.length < maxLen) {
    minimum.totalBals.push(minimum.totalBals[minimum.totalBals.length - 1] || 0)
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
