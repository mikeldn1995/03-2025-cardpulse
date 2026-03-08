"use client"

import { useState, useMemo } from "react"
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine
} from "recharts"
import { useStore } from "@/lib/store"
import { computeForecast, ForecastData, CardForecast } from "@/lib/forecast"
import { fmt, cn, currencySymbol, getBalance, getIssuerColor } from "@/lib/utils"

export default function ForecastPage() {
  const { cards, forecastMonthly, setForecastMonthly, currency } = useStore()
  const [inputVal, setInputVal] = useState(forecastMonthly.toString())
  const [extraPayment, setExtraPayment] = useState(0)
  const [breakdownOpen, setBreakdownOpen] = useState(false)

  const totalBal = cards.reduce((s, c) => s + getBalance(c), 0)
  const sym = currencySymbol(currency)

  // Base forecast with current monthly payment
  const fc = useMemo(
    () => computeForecast(cards, forecastMonthly),
    [cards, forecastMonthly]
  )

  // "What if" forecast with extra payment
  const fcExtra = useMemo(
    () => (extraPayment > 0 ? computeForecast(cards, forecastMonthly + extraPayment) : null),
    [cards, forecastMonthly, extraPayment]
  )

  const handleInput = (v: string) => {
    setInputVal(v)
    const n = parseFloat(v)
    if (!isNaN(n) && n > 0) setForecastMonthly(n)
  }

  // Build chart data from active forecast (extra if slider > 0, else base)
  const activeFc = fcExtra ?? fc
  const data = useMemo(() => {
    if (!activeFc) return []
    return activeFc.labels.map((label, i) => ({
      label,
      balance: Math.round(activeFc.custom.totalBals[i] * 100) / 100,
    }))
  }, [activeFc])

  // Promo expiry markers
  const promoMarkers = useMemo(() => {
    if (!activeFc || data.length === 0) return []
    const now = new Date()
    const markers: { label: string; issuer: string }[] = []
    const seen = new Set<string>()

    cards.forEach(c => {
      if (c.aprPromo === null || !c.promoUntil) return
      const expiry = new Date(c.promoUntil)
      if (expiry <= now) return
      const monthsAway =
        (expiry.getFullYear() - now.getFullYear()) * 12 +
        (expiry.getMonth() - now.getMonth())
      if (monthsAway < 1 || monthsAway > data.length) return
      const labelIdx = monthsAway - 1
      const label = data[labelIdx]?.label
      if (!label || seen.has(label)) return
      seen.add(label)
      markers.push({ label, issuer: c.issuer })
    })
    return markers
  }, [cards, data, activeFc])

  const tickInterval =
    data.length > 48 ? 11 : data.length > 24 ? 5 : data.length > 12 ? 2 : 0

  const formatY = (v: number) =>
    `${sym}${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v.toFixed(0)}`
  const tooltipFmt = (v: number) => fmt(v, currency)

  // Summary stats
  const payoffMonths = activeFc?.payoffMonthCustom ?? null
  const totalInterest = activeFc?.totalInterestCustom ?? 0
  const paidOff = activeFc?.custom.paidOff ?? false
  const remainingBal = activeFc
    ? activeFc.custom.totalBals[activeFc.custom.totalBals.length - 1] ?? 0
    : 0

  // Savings comparison when slider is active
  const interestSaved =
    fc && fcExtra ? fc.totalInterestCustom - fcExtra.totalInterestCustom : 0
  const monthsSaved =
    fc && fcExtra
      ? (fc.payoffMonthCustom ?? fc.custom.months.length) -
        (fcExtra.payoffMonthCustom ?? fcExtra.custom.months.length)
      : 0

  // Per-card breakdown sorted by payoff date (longest first)
  const perCardSorted = useMemo(() => {
    if (!activeFc) return []
    return [...activeFc.perCard].sort((a, b) => {
      const aMonth = a.payoffMonth ?? 999
      const bMonth = b.payoffMonth ?? 999
      return bMonth - aMonth
    })
  }, [activeFc])

  if (totalBal <= 0) {
    return (
      <>
        <div className="pb-3">
          <p className="text-[0.8125rem] text-muted-foreground">
            No balances to forecast
          </p>
        </div>
        <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
          All balances are zero -- nothing to project.
        </div>
      </>
    )
  }

  return (
    <>
      <div className="pb-3">
        <p className="text-[0.8125rem] text-muted-foreground">
          Project your repayment timeline
        </p>
      </div>

      {/* Monthly payment input */}
      <div className="bg-card border border-border rounded-lg p-4 mb-4">
        <label className="text-[0.6875rem] uppercase tracking-wider text-muted-foreground font-medium block mb-1.5">
          Monthly Repayment
        </label>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">
            {sym}
          </span>
          <input
            type="number"
            min="1"
            step="50"
            value={inputVal}
            onChange={e => handleInput(e.target.value)}
            className="h-9 w-28 px-3 text-sm bg-background border border-border rounded-md outline-none focus:border-ring tabular-nums"
          />
          <span className="text-xs text-muted-foreground">
            / month across all cards
          </span>
        </div>
        <div className="text-xs text-muted-foreground mt-2">
          Total balance:{" "}
          <span className="font-medium text-foreground">
            {fmt(totalBal, currency)}
          </span>
        </div>
      </div>

      {/* Stale manual cards warning */}
      {fc && fc.staleManualCount > 0 && (
        <div className="bg-warning/10 border border-warning/20 rounded-lg px-3 py-2 mb-3">
          <div className="text-xs text-warning font-medium">
            Forecast may be inaccurate -- {fc.staleManualCount} manual{" "}
            {fc.staleManualCount === 1 ? "card hasn't" : "cards haven't"} been
            updated recently
          </div>
        </div>
      )}

      {/* Promo expiry notice */}
      {promoMarkers.length > 0 && (
        <div className="bg-warning/10 border border-warning/20 rounded-lg px-3 py-2 mb-3">
          <div className="text-[0.6875rem] font-medium text-warning mb-0.5">
            Promo Rate Expiry
          </div>
          {promoMarkers.map(m => (
            <div key={m.label} className="text-xs text-muted-foreground">
              {m.issuer} promo ends {m.label} -- interest will increase
            </div>
          ))}
        </div>
      )}

      {/* Summary stats */}
      {activeFc && (
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-card border border-border rounded-lg p-3">
            <div className="text-[0.6875rem] uppercase tracking-wider text-muted-foreground font-medium mb-1">
              {paidOff ? "Debt-free in" : "Payoff timeline"}
            </div>
            <div className="text-lg font-semibold">
              {paidOff && payoffMonths !== null ? (
                <>
                  {payoffMonths} {payoffMonths === 1 ? "month" : "months"}
                </>
              ) : (
                <span className="text-destructive text-sm">
                  Not repaid within 5 years
                </span>
              )}
            </div>
            {!paidOff && (
              <div className="text-xs text-muted-foreground mt-0.5">
                Remaining: {fmt(remainingBal, currency)}
              </div>
            )}
          </div>
          <div className="bg-card border border-border rounded-lg p-3">
            <div className="text-[0.6875rem] uppercase tracking-wider text-muted-foreground font-medium mb-1">
              Total interest
            </div>
            <div className="text-lg font-semibold">
              {fmt(totalInterest, currency)}
            </div>
            {!paidOff && (
              <div className="text-xs text-muted-foreground mt-0.5">
                Over 5 years
              </div>
            )}
          </div>
        </div>
      )}

      {/* Payoff chart */}
      {activeFc && data.length > 0 && (
        <div className="bg-card border border-border rounded-lg p-3 mb-4">
          <div className="text-xs font-medium mb-2">Balance Over Time</div>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart
              data={data}
              margin={{ top: 5, right: 5, left: -10, bottom: 5 }}
            >
              <defs>
                <linearGradient id="payoffGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="0%"
                    stopColor="hsl(142, 76%, 36%)"
                    stopOpacity={0.3}
                  />
                  <stop
                    offset="100%"
                    stopColor="hsl(142, 76%, 36%)"
                    stopOpacity={0.02}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10 }}
                interval={tickInterval}
              />
              <YAxis tickFormatter={formatY} tick={{ fontSize: 10 }} />
              <Tooltip
                formatter={tooltipFmt}
                contentStyle={{
                  fontSize: 12,
                  borderRadius: 8,
                  border: "1px solid hsl(var(--border))",
                  background: "hsl(var(--card))",
                }}
              />
              <ReferenceLine
                y={0}
                stroke="hsl(var(--muted-foreground))"
                strokeDasharray="4 4"
                strokeWidth={1}
              />
              {promoMarkers.map(m => (
                <ReferenceLine
                  key={m.label}
                  x={m.label}
                  stroke="hsl(38, 92%, 50%)"
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                  label={{
                    value: `${m.issuer} promo ends`,
                    position: "top",
                    fill: "hsl(38, 92%, 50%)",
                    fontSize: 9,
                  }}
                />
              ))}
              <Area
                type="monotone"
                dataKey="balance"
                name="Balance"
                stroke="hsl(142, 76%, 36%)"
                strokeWidth={2}
                fill="url(#payoffGradient)"
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* What-if slider */}
      <div className="bg-card border border-border rounded-lg p-4 mb-4">
        <label className="text-[0.6875rem] uppercase tracking-wider text-muted-foreground font-medium block mb-2">
          What if I paid extra per month?
        </label>
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-muted-foreground">
            {sym}0
          </span>
          <input
            type="range"
            min={0}
            max={500}
            step={10}
            value={extraPayment}
            onChange={e => setExtraPayment(Number(e.target.value))}
            className="flex-1 h-2 accent-foreground"
          />
          <span className="text-sm font-medium text-muted-foreground">
            {sym}500
          </span>
        </div>
        <div className="text-sm font-semibold mt-2">
          +{fmt(extraPayment, currency)}/month
        </div>
        {extraPayment > 0 && fc && fcExtra && (
          <div className="mt-2 text-xs bg-success/10 border border-success/20 rounded-md px-3 py-2">
            <span className="font-medium text-success">
              {fmt(extraPayment, currency)} extra/month
            </span>{" "}
            <span className="text-muted-foreground">saves </span>
            <span className="font-semibold">
              {fmt(Math.max(0, interestSaved), currency)}
            </span>
            <span className="text-muted-foreground"> in interest</span>
            {monthsSaved > 0 && (
              <>
                <span className="text-muted-foreground"> and </span>
                <span className="font-semibold">
                  {monthsSaved} {monthsSaved === 1 ? "month" : "months"}
                </span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Smart strategy tip */}
      {fc?.strategy && (
        <div className="border-l-4 border-blue-500/60 bg-blue-500/5 rounded-r-lg px-3 py-2.5 mb-4">
          <div className="text-[0.6875rem] uppercase tracking-wider text-blue-600 dark:text-blue-400 font-semibold mb-0.5">
            Strategy Tip
          </div>
          <div className="text-xs text-muted-foreground">
            {fc.strategy.message}
          </div>
        </div>
      )}

      {/* Per-card breakdown */}
      {perCardSorted.length > 0 && (
        <div className="bg-card border border-border rounded-lg mb-4 overflow-hidden">
          <button
            onClick={() => setBreakdownOpen(o => !o)}
            className="w-full flex items-center justify-between px-4 py-3 text-left"
          >
            <span className="text-xs font-medium">Per-Card Breakdown</span>
            <svg
              className={cn(
                "w-4 h-4 text-muted-foreground transition-transform",
                breakdownOpen && "rotate-180"
              )}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>
          {breakdownOpen && (
            <div className="border-t border-border divide-y divide-border">
              {perCardSorted.map(card => {
                const colors = getIssuerColor(card.issuer)
                const now = new Date()
                const payoffDate =
                  card.payoffMonth !== null
                    ? new Date(
                        now.getFullYear(),
                        now.getMonth() + card.payoffMonth,
                        1
                      ).toLocaleDateString("en-GB", {
                        month: "short",
                        year: "numeric",
                      })
                    : null
                return (
                  <div key={card.cardId} className="px-4 py-3">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span
                        className={cn(
                          "inline-block w-2 h-2 rounded-full",
                          colors.bg.replace("/10", "/60")
                        )}
                      />
                      <span className={cn("text-xs font-semibold", colors.text)}>
                        {card.issuer}
                      </span>
                      <span className="text-[0.6875rem] text-muted-foreground">
                        {card.last4 ? `****${card.last4}` : ""}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <div className="text-[0.625rem] text-muted-foreground uppercase tracking-wider">
                          Balance
                        </div>
                        <div className="text-xs font-medium">
                          {fmt(card.startBalance, currency)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[0.625rem] text-muted-foreground uppercase tracking-wider">
                          Payoff
                        </div>
                        <div className="text-xs font-medium">
                          {payoffDate ?? "5yr+"}
                        </div>
                      </div>
                      <div>
                        <div className="text-[0.625rem] text-muted-foreground uppercase tracking-wider">
                          Interest
                        </div>
                        <div className="text-xs font-medium">
                          {fmt(card.totalInterest, currency)}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </>
  )
}
