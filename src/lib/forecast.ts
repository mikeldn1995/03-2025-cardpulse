import { CreditCard } from "@/types/card"
import { getEffectiveAPR, getBalance } from "@/lib/utils"

export interface CardForecast {
  cardId: number
  issuer: string
  last4: string
  payoffMonth: number | null
  totalInterest: number
  startBalance: number
}

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
  perCard: CardForecast[]
  strategy: StrategyTip | null
  payoffMonthCustom: number | null
  totalInterestCustom: number
  totalInterestMinimum: number
  staleManualCount: number
}

export interface StrategyTip {
  type: "avalanche" | "promo-aware"
  message: string
  focusCardId: number
  focusCardName: string
}

function getAverages(card: CreditCard): { avgDebits: number; avgCredits: number } {
  const sorted = [...card.monthlyRecords].sort((a, b) => b.month.localeCompare(a.month))
  const recent = sorted.slice(0, 3)
  if (recent.length === 0) return { avgDebits: 0, avgCredits: 0 }
  const avgDebits = recent.reduce((s, r) => s + r.debits, 0) / recent.length
  const avgCredits = recent.reduce((s, r) => s + r.credits, 0) / recent.length
  return { avgDebits, avgCredits }
}

function simulate(cards: CreditCard[], getPayment: (totalBal: number) => number, trackPerCard?: boolean): ForecastResult & { perCard?: CardForecast[] } {
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

  const perCardInterest = cards.map(() => 0)
  const perCardPaidOff = cards.map(() => null as number | null)

  const MAX_MONTHS = 60
  for (let m = 1; m <= MAX_MONTHS; m++) {
    const totalB = balances.reduce((s, b) => s + Math.max(0, b), 0)
    if (totalB <= 0.5) break

    const forecastDate = new Date(now.getFullYear(), now.getMonth() + m, 1)

    let monthInterest = 0
    for (let i = 0; i < balances.length; i++) {
      if (balances[i] <= 0) continue
      balances[i] += averages[i].avgDebits
      const rate = (promoRates[i] !== null && promoExpiry[i] && forecastDate < promoExpiry[i]!)
        ? promoRates[i]! : regularRates[i]
      const interest = balances[i] * rate
      monthInterest += interest
      perCardInterest[i] += interest
      balances[i] += interest
    }

    const payment = getPayment(totalB)
    const currentTotal = balances.reduce((s, b) => s + Math.max(0, b), 0)
    const remaining = Math.min(payment, currentTotal)

    for (let i = 0; i < balances.length; i++) {
      if (balances[i] <= 0) continue
      const share = currentTotal > 0 ? balances[i] / currentTotal : 0
      const pay = Math.min(remaining * share, balances[i])
      balances[i] -= pay
      if (balances[i] <= 0.5 && perCardPaidOff[i] === null) perCardPaidOff[i] = m
    }

    cumInterest += monthInterest
    totalBals.push(balances.reduce((s, b) => s + Math.max(0, b), 0))
    totalInterests.push(cumInterest)
    months.push(m)

    if (balances.reduce((s, b) => s + Math.max(0, b), 0) <= 0.5) break
  }

  const finalBal = balances.reduce((s, b) => s + Math.max(0, b), 0)
  const result: ForecastResult & { perCard?: CardForecast[] } = {
    months, totalBals, totalInterests, paidOff: finalBal <= 0.5,
  }

  if (trackPerCard) {
    result.perCard = cards.map((c, i) => ({
      cardId: c.id,
      issuer: c.issuer,
      last4: c.last4,
      payoffMonth: perCardPaidOff[i],
      totalInterest: Math.round(perCardInterest[i] * 100) / 100,
      startBalance: getBalance(c),
    }))
  }

  return result
}

function generateStrategy(cards: CreditCard[]): StrategyTip | null {
  const withBalance = cards.filter(c => getBalance(c) > 0)
  if (withBalance.length < 2) return null

  const now = new Date()
  const promoCards = withBalance.filter(c =>
    c.aprPromo !== null && c.promoUntil && new Date(c.promoUntil) > now
  )

  if (promoCards.length > 0) {
    const nonPromo = withBalance.filter(c => !promoCards.includes(c))
    if (nonPromo.length > 0) {
      const highestAPR = nonPromo.sort((a, b) => b.aprRegular - a.aprRegular)[0]
      const promoNames = promoCards.map(c => c.issuer).join(", ")
      return {
        type: "promo-aware",
        message: `Pay minimums on ${promoNames} (promo rate), focus extra payments on ${highestAPR.issuer} (${highestAPR.aprRegular}% APR)`,
        focusCardId: highestAPR.id,
        focusCardName: highestAPR.issuer,
      }
    }
  }

  const sorted = [...withBalance].sort((a, b) => getEffectiveAPR(b) - getEffectiveAPR(a))
  const highestAPR = sorted[0]
  return {
    type: "avalanche",
    message: `Focus extra payments on ${highestAPR.issuer} (${getEffectiveAPR(highestAPR)}% APR) to save the most on interest`,
    focusCardId: highestAPR.id,
    focusCardName: highestAPR.issuer,
  }
}

export function computeForecast(cards: CreditCard[], monthlyPayment: number): ForecastData | null {
  const totalBal = cards.reduce((s, c) => s + getBalance(c), 0)
  if (totalBal <= 0) return null

  function minPayment(bal: number) {
    return Math.max(bal * 0.05, Math.min(25, bal))
  }

  const customResult = simulate(cards, () => monthlyPayment, true)
  const minimum = simulate(cards, bal => minPayment(bal))

  const maxLen = Math.max(customResult.months.length, minimum.months.length)
  const labels: string[] = []
  const now = new Date()
  for (let i = 0; i < maxLen; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + 1 + i, 1)
    labels.push(d.toLocaleDateString("en-GB", { month: "short", year: "2-digit" }))
  }

  const custom: ForecastResult = {
    months: customResult.months,
    totalBals: customResult.totalBals,
    totalInterests: customResult.totalInterests,
    paidOff: customResult.paidOff,
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

  const payoffIdx = custom.totalBals.findIndex(b => b <= 0.5)
  const payoffMonthCustom = payoffIdx >= 0 ? payoffIdx + 1 : null

  const strategy = generateStrategy(cards)

  // Count stale manual cards
  const cm = now
  const staleManualCount = cards.filter(c => {
    if (c.source !== "manual") return false
    const lastRecord = [...c.monthlyRecords].sort((a, b) => b.month.localeCompare(a.month))[0]
    if (!lastRecord) return true
    const [y, m] = lastRecord.month.split("-").map(Number)
    const recordDate = new Date(y, m - 1)
    const twoMonthsAgo = new Date(cm.getFullYear(), cm.getMonth() - 2, 1)
    return recordDate < twoMonthsAgo
  }).length

  return {
    custom,
    minimum,
    labels,
    maxLen,
    customMonthlyInt,
    minimumMonthlyInt,
    customPrincipal,
    perCard: customResult.perCard || [],
    strategy,
    payoffMonthCustom,
    totalInterestCustom: custom.totalInterests[custom.totalInterests.length - 1] || 0,
    totalInterestMinimum: minimum.totalInterests[minimum.totalInterests.length - 1] || 0,
    staleManualCount,
  }
}
