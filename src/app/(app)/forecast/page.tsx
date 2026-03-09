"use client"

import { useState, useMemo } from "react"
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from "recharts"
import {
  TrendingDown, ChevronDown, Clock, PiggyBank,
  Zap, CreditCard, Home, HandCoins, Landmark,
} from "lucide-react"
import { useStore } from "@/lib/store"
import { isDebtAccount, formatCurrency, getEffectiveApr, getInstitutionColor } from "@/lib/utils"
import { generateForecast } from "@/lib/forecast"
import type { Account } from "@/types"

const CATEGORY_ICONS: Record<string, typeof CreditCard> = {
  credit_card: CreditCard,
  loan: HandCoins,
  mortgage: Home,
  current_account: Landmark,
}

export default function ForecastPage() {
  const { accounts, baseCurrency } = useStore()
  const debtAccounts = useMemo(() => accounts.filter(isDebtAccount), [accounts])

  const [extraMonthly, setExtraMonthly] = useState(0)
  const [breakdownOpen, setBreakdownOpen] = useState(false)

  const forecast = useMemo(
    () => generateForecast(debtAccounts, extraMonthly),
    [debtAccounts, extraMonthly]
  )

  const forecastMin = useMemo(
    () => (extraMonthly > 0 ? generateForecast(debtAccounts, 0) : forecast),
    [debtAccounts, extraMonthly, forecast]
  )

  // Build chart data with both lines
  const chartData = useMemo(() => {
    return forecast.custom.map((p, i) => ({
      label: p.label,
      custom: Math.round(p.totalDebt * 100) / 100,
      minimum: Math.round((forecastMin.minimum[i]?.totalDebt ?? 0) * 100) / 100,
    }))
  }, [forecast, forecastMin])

  const tickInterval =
    chartData.length > 48 ? 11 : chartData.length > 24 ? 5 : chartData.length > 12 ? 2 : 0

  const formatY = (v: number) =>
    v >= 1000 ? `£${(v / 1000).toFixed(0)}k` : `£${v.toFixed(0)}`

  // Summary calculations
  const monthsSavedRaw =
    extraMonthly > 0
      ? (forecastMin.payoffMonthMinimum ?? forecastMin.minimum.length) -
        (forecast.payoffMonthCustom ?? forecast.custom.length)
      : 0
  const monthsSaved = Math.max(0, monthsSavedRaw)

  const interestSaved =
    extraMonthly > 0
      ? Math.max(0, forecastMin.totalInterestMinimum - forecast.totalInterestCustom)
      : 0

  // Per-account breakdown sorted by payoff time (longest first)
  const perAccountBreakdown = useMemo(() => {
    if (debtAccounts.length === 0) return []

    return debtAccounts
      .map((account) => {
        const singleForecast = generateForecast([account], extraMonthly)
        const singleMin = extraMonthly > 0 ? generateForecast([account], 0) : singleForecast

        return {
          account,
          payoffMonth: singleForecast.payoffMonthCustom,
          payoffMonthMin: singleMin.payoffMonthMinimum,
          totalInterest: singleForecast.totalInterestCustom,
          apr: getEffectiveApr(account),
        }
      })
      .sort((a, b) => (b.payoffMonth ?? 999) - (a.payoffMonth ?? 999))
  }, [debtAccounts, extraMonthly])

  // ── Empty State ───────────────────────────────────────────
  if (debtAccounts.length === 0) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div
          className="w-full rounded-2xl p-8 text-center"
          style={{ backgroundColor: "#1B2A4A" }}
        >
          <div
            className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full"
            style={{ backgroundColor: "rgba(255,255,255,0.08)" }}
          >
            <PiggyBank className="h-7 w-7 text-emerald-400" />
          </div>
          <h2 className="mb-2 text-lg font-semibold text-white">
            No debts to forecast
          </h2>
          <p className="text-sm text-slate-400">
            You&apos;re debt-free! Nothing to project here.
          </p>
        </div>
      </div>
    )
  }

  const totalDebt = debtAccounts.reduce((s, a) => s + Math.abs(a.balance), 0)

  return (
    <div className="space-y-4 pb-8">
      {/* Header */}
      <div>
        <h1 className="text-lg font-bold text-white">Payoff Forecast</h1>
        <p className="text-sm text-slate-400">
          {debtAccounts.length} debt account{debtAccounts.length !== 1 ? "s" : ""} totalling{" "}
          <span className="font-semibold text-white">
            {formatCurrency(totalDebt, baseCurrency)}
          </span>
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl p-4" style={{ backgroundColor: "#1B2A4A" }}>
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-[hsl(217,70%,50%)]" />
            <span className="text-[0.6875rem] uppercase tracking-wider text-slate-400 font-medium">
              {forecast.payoffMonthCustom !== null ? "Debt-free in" : "Payoff timeline"}
            </span>
          </div>
          <div className="text-xl font-bold text-white">
            {forecast.payoffMonthCustom !== null ? (
              <>
                {forecast.payoffMonthCustom}{" "}
                <span className="text-sm font-medium text-slate-400">
                  {forecast.payoffMonthCustom === 1 ? "month" : "months"}
                </span>
              </>
            ) : (
              <span className="text-sm text-red-400">Not within 5 years</span>
            )}
          </div>
        </div>
        <div className="rounded-2xl p-4" style={{ backgroundColor: "#1B2A4A" }}>
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown className="w-4 h-4 text-[hsl(217,70%,50%)]" />
            <span className="text-[0.6875rem] uppercase tracking-wider text-slate-400 font-medium">
              Total Interest
            </span>
          </div>
          <div className="text-xl font-bold text-white">
            {formatCurrency(forecast.totalInterestCustom, baseCurrency)}
          </div>
        </div>
      </div>

      {/* Interest saved banner when extra > 0 */}
      {extraMonthly > 0 && interestSaved > 0 && (
        <div
          className="rounded-xl px-4 py-3 flex items-start gap-3"
          style={{ backgroundColor: "rgba(16, 185, 129, 0.12)" }}
        >
          <PiggyBank className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-emerald-400">
              {formatCurrency(interestSaved, baseCurrency)} saved in interest
            </p>
            {monthsSaved > 0 && (
              <p className="text-xs text-slate-400 mt-0.5">
                Debt-free {monthsSaved} {monthsSaved === 1 ? "month" : "months"} sooner
              </p>
            )}
          </div>
        </div>
      )}

      {/* Area Chart */}
      {chartData.length > 1 && (
        <div className="rounded-2xl p-4" style={{ backgroundColor: "#1B2A4A" }}>
          <p className="text-xs font-medium text-white mb-3">Total Debt Over Time</p>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -10, bottom: 5 }}>
              <defs>
                <linearGradient id="forecastGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(217, 70%, 50%)" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="hsl(217, 70%, 50%)" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="minimumGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#64748B" stopOpacity={0.15} />
                  <stop offset="100%" stopColor="#64748B" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: "#94A3B8" }}
                interval={tickInterval}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={formatY}
                tick={{ fontSize: 10, fill: "#94A3B8" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                formatter={(value: number, name: string) => [
                  formatCurrency(value, baseCurrency),
                  name === "minimum" ? "Minimum payments" : "With extra",
                ]}
                contentStyle={{
                  fontSize: 12,
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.1)",
                  background: "#0F172A",
                  color: "#fff",
                }}
                labelStyle={{ color: "#94A3B8" }}
              />
              <ReferenceLine
                y={0}
                stroke="rgba(255,255,255,0.1)"
                strokeDasharray="4 4"
              />
              {/* Minimum payments line (muted) */}
              {extraMonthly > 0 && (
                <Area
                  type="monotone"
                  dataKey="minimum"
                  name="minimum"
                  stroke="#64748B"
                  strokeWidth={1.5}
                  strokeDasharray="6 3"
                  fill="url(#minimumGradient)"
                  dot={false}
                />
              )}
              {/* With extra / active line (primary blue) */}
              <Area
                type="monotone"
                dataKey="custom"
                name="custom"
                stroke="hsl(217, 70%, 50%)"
                strokeWidth={2}
                fill="url(#forecastGradient)"
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
          {extraMonthly > 0 && (
            <div className="flex items-center gap-4 mt-2 px-1">
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-0.5 bg-slate-500" style={{ borderTop: "1.5px dashed #64748B" }} />
                <span className="text-[0.625rem] text-slate-400">Minimum</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-0.5 rounded-full" style={{ backgroundColor: "hsl(217, 70%, 50%)" }} />
                <span className="text-[0.625rem] text-slate-400">With extra</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* What-if Slider */}
      <div className="rounded-2xl p-4" style={{ backgroundColor: "#1B2A4A" }}>
        <label className="text-[0.6875rem] uppercase tracking-wider text-slate-400 font-medium block mb-3">
          Extra monthly payment:{" "}
          <span className="text-white font-semibold text-sm normal-case">
            {formatCurrency(extraMonthly, baseCurrency)}
          </span>
        </label>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500">£0</span>
          <input
            type="range"
            min={0}
            max={500}
            step={25}
            value={extraMonthly}
            onChange={(e) => setExtraMonthly(Number(e.target.value))}
            className="flex-1 h-2 accent-[hsl(217,70%,50%)] rounded-full"
          />
          <span className="text-xs text-slate-500">£500</span>
        </div>
      </div>

      {/* Per-Account Breakdown */}
      {perAccountBreakdown.length > 0 && (
        <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: "#1B2A4A" }}>
          <button
            onClick={() => setBreakdownOpen((o) => !o)}
            className="w-full flex items-center justify-between px-4 py-3.5 active:bg-white/5 transition-colors"
          >
            <span className="text-sm font-medium text-white">Per-Account Breakdown</span>
            <ChevronDown
              className={`w-4 h-4 text-slate-400 transition-transform ${
                breakdownOpen ? "rotate-180" : ""
              }`}
            />
          </button>
          {breakdownOpen && (
            <div className="border-t border-white/5 divide-y divide-white/5">
              {perAccountBreakdown.map(({ account, payoffMonth, totalInterest, apr }) => {
                const Icon = CATEGORY_ICONS[account.category] || CreditCard
                const bgColor = getInstitutionColor(account.institution)
                const now = new Date()
                const payoffDate =
                  payoffMonth !== null
                    ? new Date(
                        now.getFullYear(),
                        now.getMonth() + payoffMonth,
                        1
                      ).toLocaleDateString("en-GB", {
                        month: "short",
                        year: "numeric",
                      })
                    : null

                return (
                  <div key={account.id} className="px-4 py-3.5">
                    <div className="flex items-center gap-3 mb-2.5">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                        style={{ backgroundColor: bgColor }}
                      >
                        <Icon className="w-4 h-4 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white truncate">
                          {account.institution}
                        </p>
                        <p className="text-xs text-slate-400">
                          ••{account.last4} &middot; {apr.toFixed(1)}% APR
                        </p>
                      </div>
                      <span className="text-sm font-semibold text-white tabular-nums">
                        {formatCurrency(Math.abs(account.balance), account.currency)}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-[0.625rem] uppercase tracking-wider text-slate-500 mb-0.5">
                          Payoff
                        </p>
                        <p className="text-xs font-medium text-white">
                          {payoffDate ?? "5yr+"}
                        </p>
                      </div>
                      <div>
                        <p className="text-[0.625rem] uppercase tracking-wider text-slate-500 mb-0.5">
                          Interest
                        </p>
                        <p className="text-xs font-medium text-white">
                          {formatCurrency(totalInterest, account.currency)}
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Strategy Tips */}
      {forecast.strategies.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 px-1">
            Strategy Tips
          </p>
          {forecast.strategies.map((tip, i) => (
            <div
              key={i}
              className="rounded-2xl px-4 py-3.5"
              style={{
                backgroundColor: "rgba(59, 130, 246, 0.08)",
                borderLeft: "3px solid hsl(217, 70%, 50%)",
              }}
            >
              <div className="flex items-center gap-2 mb-1">
                <Zap className="w-3.5 h-3.5 text-[hsl(217,70%,50%)]" />
                <span className="text-sm font-semibold text-white">{tip.title}</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                {tip.description}
              </p>
              {tip.savingsEstimate !== null && tip.savingsEstimate > 0 && (
                <p className="text-xs font-semibold text-emerald-400 mt-1.5">
                  Potential savings: {formatCurrency(tip.savingsEstimate, baseCurrency)}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
