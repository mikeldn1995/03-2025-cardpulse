import { db } from "@/db"
import { exchangeRates } from "@/db/schema"
import { desc } from "drizzle-orm"

const OXR_APP_ID = process.env.OPEN_EXCHANGE_RATES_APP_ID

export async function getExchangeRates(): Promise<Record<string, number>> {
  // Check cache (valid for 24h)
  const cached = await db
    .select()
    .from(exchangeRates)
    .orderBy(desc(exchangeRates.fetchedAt))
    .limit(1)

  if (cached.length > 0) {
    const age = Date.now() - new Date(cached[0].fetchedAt).getTime()
    if (age < 24 * 60 * 60 * 1000) {
      return cached[0].rates as Record<string, number>
    }
  }

  // Fetch fresh rates
  if (!OXR_APP_ID) {
    console.warn("No OPEN_EXCHANGE_RATES_APP_ID — using fallback rates")
    return { GBP: 1, USD: 1.27, EUR: 1.17 }
  }

  const res = await fetch(`https://openexchangerates.org/api/latest.json?app_id=${OXR_APP_ID}`)
  if (!res.ok) {
    console.error("Failed to fetch exchange rates:", res.status)
    if (cached.length > 0) return cached[0].rates as Record<string, number>
    return { GBP: 1, USD: 1.27, EUR: 1.17 }
  }

  const data = await res.json()
  const rates = data.rates as Record<string, number>

  // Cache in DB
  await db.insert(exchangeRates).values({
    baseCurrency: "USD",
    rates,
  })

  return rates
}

export function convertToBase(amount: number, fromCurrency: string, baseCurrency: string, rates: Record<string, number>): number {
  if (fromCurrency === baseCurrency) return amount
  const fromRate = rates[fromCurrency] || 1
  const toRate = rates[baseCurrency] || 1
  return (amount / fromRate) * toRate
}
