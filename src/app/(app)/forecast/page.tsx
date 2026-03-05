"use client"

import { useState, useMemo } from "react"
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart
} from "recharts"
import { useStore } from "@/lib/store"
import { computeForecast } from "@/lib/forecast"
import { fmt, cn, currencySymbol } from "@/lib/utils"

type ChartType = "balance" | "interest" | "burn" | "combined" | "stacked" | "summary"

const CHART_TABS: { key: ChartType; label: string }[] = [
  { key: "balance", label: "Balance" },
  { key: "interest", label: "Interest" },
  { key: "burn", label: "Burn Rate" },
  { key: "combined", label: "Combined" },
  { key: "stacked", label: "Breakdown" },
  { key: "summary", label: "Summary" },
]

export default function ForecastPage() {
  const { cards, forecastMonthly, setForecastMonthly, currency } = useStore()
  const [chart, setChart] = useState<ChartType>("balance")
  const [inputVal, setInputVal] = useState(forecastMonthly.toString())

  const totalBal = cards.reduce((s, c) => s + c.balance, 0)
  const fc = useMemo(() => computeForecast(cards, forecastMonthly), [cards, forecastMonthly])

  const handleInput = (v: string) => {
    setInputVal(v)
    const n = parseFloat(v)
    if (!isNaN(n) && n > 0) setForecastMonthly(n)
  }

  // Build chart data array
  const data = useMemo(() => {
    if (!fc) return []
    return fc.labels.map((label, i) => ({
      label,
      customBal: Math.round(fc.custom.totalBals[i] * 100) / 100,
      minBal: Math.round(fc.minimum.totalBals[i] * 100) / 100,
      customInt: Math.round(fc.custom.totalInterests[i] * 100) / 100,
      minInt: Math.round(fc.minimum.totalInterests[i] * 100) / 100,
      customMonthlyInt: Math.round(fc.customMonthlyInt[i] * 100) / 100,
      minMonthlyInt: Math.round(fc.minimumMonthlyInt[i] * 100) / 100,
      principal: Math.round(fc.customPrincipal[i] * 100) / 100,
    }))
  }, [fc])

  // Determine tick interval for x-axis
  const tickInterval = data.length > 48 ? 11 : data.length > 24 ? 5 : data.length > 12 ? 2 : 0

  const sym = currencySymbol(currency)
  const formatY = (v: number) => `${sym}${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v.toFixed(0)}`
  const tooltipFmt = (v: number) => fmt(v, currency)

  if (totalBal <= 0) {
    return (
      <>
        <div className="pb-4">
          <h2 className="text-xl font-semibold tracking-tight">Forecast</h2>
          <p className="text-[0.8125rem] text-muted-foreground mt-0.5">No balances to forecast</p>
        </div>
        <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
          All balances are zero — nothing to project.
        </div>
      </>
    )
  }

  return (
    <>
      <div className="pb-4">
        <h2 className="text-xl font-semibold tracking-tight">Forecast</h2>
        <p className="text-[0.8125rem] text-muted-foreground mt-0.5">Project your repayment timeline</p>
      </div>

      {/* Monthly payment input */}
      <div className="bg-card border border-border rounded-lg p-4 mb-4">
        <label className="text-[0.6875rem] uppercase tracking-wider text-muted-foreground font-medium block mb-1.5">
          Monthly Repayment
        </label>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">{sym}</span>
          <input
            type="number"
            min="1"
            step="50"
            value={inputVal}
            onChange={e => handleInput(e.target.value)}
            className="h-9 w-28 px-3 text-sm bg-background border border-border rounded-md outline-none focus:border-ring tabular-nums"
          />
          <span className="text-xs text-muted-foreground">/ month across all cards</span>
        </div>
        <div className="text-xs text-muted-foreground mt-2">
          Total balance: <span className="font-medium text-foreground">{fmt(totalBal, currency)}</span>
        </div>
      </div>

      {/* Chart tabs */}
      <div className="flex gap-1 overflow-x-auto pb-2 mb-3 -mx-1 px-1 no-scrollbar">
        {CHART_TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setChart(t.key)}
            className={cn(
              "px-3 py-1.5 text-xs font-medium rounded-md shrink-0 transition-colors",
              chart === t.key
                ? "bg-foreground text-background"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Charts */}
      {fc && (
        <div className="bg-card border border-border rounded-lg p-3">
          {chart === "balance" && (
            <>
              <div className="text-xs font-medium mb-2">Balance Over Time</div>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={data} margin={{ top: 5, right: 5, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={tickInterval} />
                  <YAxis tickFormatter={formatY} tick={{ fontSize: 10 }} />
                  <Tooltip formatter={tooltipFmt} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="customBal" name="Your Plan" stroke="hsl(142, 76%, 36%)" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="minBal" name="Minimum Only" stroke="hsl(0, 84%, 60%)" strokeWidth={2} dot={false} strokeDasharray="5 5" />
                </LineChart>
              </ResponsiveContainer>
            </>
          )}

          {chart === "interest" && (
            <>
              <div className="text-xs font-medium mb-2">Cumulative Interest Paid</div>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={data} margin={{ top: 5, right: 5, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={tickInterval} />
                  <YAxis tickFormatter={formatY} tick={{ fontSize: 10 }} />
                  <Tooltip formatter={tooltipFmt} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="customInt" name="Your Plan" stroke="hsl(38, 92%, 50%)" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="minInt" name="Minimum Only" stroke="hsl(0, 84%, 60%)" strokeWidth={2} dot={false} strokeDasharray="5 5" />
                </LineChart>
              </ResponsiveContainer>
            </>
          )}

          {chart === "burn" && (
            <>
              <div className="text-xs font-medium mb-2">Monthly Interest Burn Rate</div>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={data} margin={{ top: 5, right: 5, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={tickInterval} />
                  <YAxis tickFormatter={formatY} tick={{ fontSize: 10 }} />
                  <Tooltip formatter={tooltipFmt} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="customMonthlyInt" name="Your Plan" fill="hsl(38, 92%, 50%)" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="minMonthlyInt" name="Minimum Only" fill="hsl(0, 84%, 60%)" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </>
          )}

          {chart === "combined" && (
            <>
              <div className="text-xs font-medium mb-2">Balance + Cumulative Interest</div>
              <ResponsiveContainer width="100%" height={260}>
                <ComposedChart data={data} margin={{ top: 5, right: 5, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={tickInterval} />
                  <YAxis tickFormatter={formatY} tick={{ fontSize: 10 }} />
                  <Tooltip formatter={tooltipFmt} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Area type="monotone" dataKey="customBal" name="Balance" fill="hsl(142, 76%, 36%)" fillOpacity={0.15} stroke="hsl(142, 76%, 36%)" strokeWidth={2} />
                  <Line type="monotone" dataKey="customInt" name="Interest Paid" stroke="hsl(38, 92%, 50%)" strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </>
          )}

          {chart === "stacked" && (
            <>
              <div className="text-xs font-medium mb-2">Principal vs Interest Breakdown</div>
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={data} margin={{ top: 5, right: 5, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={tickInterval} />
                  <YAxis tickFormatter={formatY} tick={{ fontSize: 10 }} />
                  <Tooltip formatter={tooltipFmt} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Area type="monotone" dataKey="principal" name="Principal Repaid" stackId="1" fill="hsl(142, 76%, 36%)" fillOpacity={0.6} stroke="hsl(142, 76%, 36%)" />
                  <Area type="monotone" dataKey="customMonthlyInt" name="Interest" stackId="1" fill="hsl(0, 84%, 60%)" fillOpacity={0.6} stroke="hsl(0, 84%, 60%)" />
                </AreaChart>
              </ResponsiveContainer>
            </>
          )}

          {chart === "summary" && (
            <div className="space-y-3">
              <div className="text-xs font-medium">Side-by-Side Comparison</div>
              <div className="grid grid-cols-2 gap-3">
                <SummaryCard
                  title="Your Plan"
                  accent="success"
                  months={fc.custom.months.length}
                  totalInterest={fc.custom.totalInterests[fc.custom.totalInterests.length - 1] || 0}
                  monthlyPayment={forecastMonthly}
                  currency={currency}
                />
                <SummaryCard
                  title="Minimum Only"
                  accent="destructive"
                  months={fc.minimum.months.length}
                  totalInterest={fc.minimum.totalInterests[fc.minimum.totalInterests.length - 1] || 0}
                  monthlyPayment={null}
                  currency={currency}
                />
              </div>
              {fc.custom.months.length < fc.minimum.months.length && (
                <div className="bg-success/10 border border-success/20 rounded-md p-3 text-xs">
                  <span className="font-semibold text-success">You save </span>
                  <span className="font-semibold">
                    {fmt(
                      (fc.minimum.totalInterests[fc.minimum.totalInterests.length - 1] || 0) -
                      (fc.custom.totalInterests[fc.custom.totalInterests.length - 1] || 0),
                      currency
                    )}
                  </span>
                  <span className="text-muted-foreground"> in interest and finish </span>
                  <span className="font-semibold">
                    {fc.minimum.months.length - fc.custom.months.length} months
                  </span>
                  <span className="text-muted-foreground"> sooner.</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </>
  )
}

function SummaryCard({
  title, accent, months, totalInterest, monthlyPayment, currency,
}: {
  title: string
  accent: "success" | "destructive"
  months: number
  totalInterest: number
  monthlyPayment: number | null
  currency: string
}) {
  const years = Math.floor(months / 12)
  const rem = months % 12

  return (
    <div className={cn(
      "border rounded-lg p-3 space-y-2",
      accent === "success" ? "border-success/30 bg-success/5" : "border-destructive/30 bg-destructive/5"
    )}>
      <div className={cn(
        "text-[0.6875rem] uppercase tracking-wider font-semibold",
        accent === "success" ? "text-success" : "text-destructive"
      )}>
        {title}
      </div>
      <div>
        <div className="text-[0.6875rem] text-muted-foreground">Time to clear</div>
        <div className="text-sm font-semibold">
          {months >= 360 ? "30+ years" : years > 0 ? `${years}y ${rem}m` : `${months}m`}
        </div>
      </div>
      <div>
        <div className="text-[0.6875rem] text-muted-foreground">Total interest</div>
        <div className="text-sm font-semibold">{fmt(totalInterest, currency)}</div>
      </div>
      {monthlyPayment !== null && (
        <div>
          <div className="text-[0.6875rem] text-muted-foreground">Monthly</div>
          <div className="text-sm font-semibold">{fmt(monthlyPayment, currency)}</div>
        </div>
      )}
    </div>
  )
}
