"use client"

import { useState, useMemo } from "react"
import {
  ChevronLeft, ChevronRight, TrendingUp, TrendingDown,
  ShoppingCart, Utensils, Car, Tv, ShoppingBag, Zap,
  Heart, Plane, GraduationCap, Repeat, Banknote, ArrowLeftRight,
  DollarSign, Percent, Shield, Palette, Home, HelpCircle,
  Upload, Receipt,
} from "lucide-react"
import { useStore } from "@/lib/store"
import { formatCurrency } from "@/lib/utils"
import type { TransactionCategory } from "@/types"

const CATEGORY_ICONS: Record<string, typeof ShoppingCart> = {
  Groceries: ShoppingCart,
  Dining: Utensils,
  Transport: Car,
  Entertainment: Tv,
  Shopping: ShoppingBag,
  "Bills & Utilities": Zap,
  Health: Heart,
  Travel: Plane,
  Education: GraduationCap,
  Subscriptions: Repeat,
  Cash: Banknote,
  Transfer: ArrowLeftRight,
  Income: DollarSign,
  Interest: Percent,
  Fees: Receipt,
  Insurance: Shield,
  Investments: TrendingUp,
  Charity: Heart,
  "Personal Care": Palette,
  Home: Home,
  Uncategorised: HelpCircle,
}

const CATEGORY_COLORS: Record<string, string> = {
  Groceries: "#22C55E",
  Dining: "#F97316",
  Transport: "#3B82F6",
  Entertainment: "#A855F7",
  Shopping: "#EC4899",
  "Bills & Utilities": "#EAB308",
  Health: "#EF4444",
  Travel: "#06B6D4",
  Education: "#8B5CF6",
  Subscriptions: "#6366F1",
  Cash: "#64748B",
  Transfer: "#94A3B8",
  Income: "#10B981",
  Interest: "#F59E0B",
  Fees: "#DC2626",
  Insurance: "#0EA5E9",
  Investments: "#14B8A6",
  Charity: "#F472B6",
  "Personal Care": "#D946EF",
  Home: "#78716C",
  Uncategorised: "#475569",
}

function getMonthString(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  return `${y}-${m}`
}

function formatMonthLabel(monthStr: string): string {
  const [y, m] = monthStr.split("-")
  const d = new Date(parseInt(y), parseInt(m) - 1)
  return d.toLocaleDateString("en-GB", { month: "long", year: "numeric" })
}

function getPreviousMonth(monthStr: string): string {
  const [y, m] = monthStr.split("-")
  const d = new Date(parseInt(y), parseInt(m) - 1 - 1)
  return getMonthString(d)
}

export default function InsightsPage() {
  const { transactions, accounts, baseCurrency } = useStore()

  const now = new Date()
  const currentMonth = getMonthString(now)
  const [selectedMonth, setSelectedMonth] = useState(currentMonth)

  const prevMonth = getPreviousMonth(selectedMonth)

  // Navigate months
  const goBack = () => {
    const [y, m] = selectedMonth.split("-")
    const d = new Date(parseInt(y), parseInt(m) - 1 - 1)
    setSelectedMonth(getMonthString(d))
  }
  const goForward = () => {
    const [y, m] = selectedMonth.split("-")
    const d = new Date(parseInt(y), parseInt(m) - 1 + 1)
    const next = getMonthString(d)
    if (next <= currentMonth) setSelectedMonth(next)
  }

  // Filter transactions by selected month — only spending (negative amounts)
  const filtered = useMemo(
    () =>
      transactions.filter(
        (t) => t.date.startsWith(selectedMonth) && t.amount < 0 && !t.isTransfer
      ),
    [transactions, selectedMonth]
  )

  // Previous month transactions for comparison
  const prevFiltered = useMemo(
    () =>
      transactions.filter(
        (t) => t.date.startsWith(prevMonth) && t.amount < 0 && !t.isTransfer
      ),
    [transactions, prevMonth]
  )

  // Group by category
  const byCategory = useMemo(() => {
    const map: Record<string, number> = {}
    for (const t of filtered) {
      const cat = t.category || "Uncategorised"
      map[cat] = (map[cat] || 0) + Math.abs(t.amount)
    }
    return Object.entries(map)
      .map(([category, total]) => ({ category, total }))
      .sort((a, b) => b.total - a.total)
  }, [filtered])

  // Previous month by category for trend
  const prevByCategory = useMemo(() => {
    const map: Record<string, number> = {}
    for (const t of prevFiltered) {
      const cat = t.category || "Uncategorised"
      map[cat] = (map[cat] || 0) + Math.abs(t.amount)
    }
    return map
  }, [prevFiltered])

  const maxCategoryAmount = byCategory.length > 0 ? byCategory[0].total : 0
  const totalSpending = byCategory.reduce((s, c) => s + c.total, 0)

  // Top merchants/descriptions
  const topDescriptions = useMemo(() => {
    const map: Record<string, number> = {}
    for (const t of filtered) {
      const desc = t.description.trim() || "Unknown"
      map[desc] = (map[desc] || 0) + Math.abs(t.amount)
    }
    return Object.entries(map)
      .map(([description, total]) => ({ description, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5)
  }, [filtered])

  // ── Empty State ───────────────────────────────────────────
  if (transactions.length === 0) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="w-full rounded-2xl p-8 text-center bg-white shadow-sm border border-border">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
            <Upload className="h-7 w-7 text-gray-300" />
          </div>
          <h2 className="mb-2 text-lg font-semibold text-[#1B2A4A]">
            No spending data yet
          </h2>
          <p className="text-sm text-muted-foreground">
            Upload statements to see spending insights
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 pb-8">
      {/* Header */}
      <div>
        <h1 className="text-lg font-bold text-[#1B2A4A]">Spending Insights</h1>
        <p className="text-sm text-muted-foreground">See where your money goes</p>
      </div>

      {/* Month Selector */}
      <div className="flex items-center justify-between rounded-2xl px-4 py-3 bg-white shadow-sm border border-border">
        <button
          onClick={goBack}
          className="w-8 h-8 rounded-full flex items-center justify-center active:bg-gray-100 transition-colors"
        >
          <ChevronLeft className="w-5 h-5 text-muted-foreground" />
        </button>
        <span className="text-sm font-semibold text-[#1B2A4A]">
          {formatMonthLabel(selectedMonth)}
        </span>
        <button
          onClick={goForward}
          disabled={selectedMonth >= currentMonth}
          className="w-8 h-8 rounded-full flex items-center justify-center active:bg-gray-100 transition-colors disabled:opacity-30"
        >
          <ChevronRight className="w-5 h-5 text-muted-foreground" />
        </button>
      </div>

      {/* Total Spending */}
      {byCategory.length > 0 && (
        <div className="text-center py-2">
          <p className="text-3xl font-bold text-[#1B2A4A] tabular-nums">
            {formatCurrency(totalSpending, baseCurrency)}
          </p>
          <p className="text-xs text-muted-foreground uppercase tracking-wider mt-1">
            Total spending
          </p>
        </div>
      )}

      {/* No data for selected month */}
      {byCategory.length === 0 && (
        <div className="rounded-2xl px-6 py-10 text-center bg-white shadow-sm border border-border">
          <p className="text-sm text-muted-foreground">
            No spending transactions for {formatMonthLabel(selectedMonth)}
          </p>
        </div>
      )}

      {/* Spending by Category */}
      {byCategory.length > 0 && (
        <div className="rounded-2xl overflow-hidden bg-white shadow-sm border border-border">
          <div className="px-4 pt-4 pb-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              By Category
            </p>
          </div>
          <div className="divide-y divide-border">
            {byCategory.map(({ category, total }) => {
              const Icon = CATEGORY_ICONS[category] || HelpCircle
              const color = CATEGORY_COLORS[category] || "#64748B"
              const widthPct = maxCategoryAmount > 0 ? (total / maxCategoryAmount) * 100 : 0
              const prevTotal = prevByCategory[category] ?? 0
              const change =
                prevTotal > 0
                  ? Math.round(((total - prevTotal) / prevTotal) * 100)
                  : null

              return (
                <div key={category} className="px-4 py-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                        style={{ backgroundColor: `${color}20` }}
                      >
                        <Icon className="w-3.5 h-3.5" style={{ color }} />
                      </div>
                      <span className="text-sm font-medium text-[#1B2A4A] truncate">
                        {category}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {change !== null && (
                        <span
                          className="text-[0.625rem] font-semibold flex items-center gap-0.5"
                          style={{
                            color: change > 0 ? "#EF4444" : change < 0 ? "#22C55E" : "#94A3B8",
                          }}
                        >
                          {change > 0 ? (
                            <TrendingUp className="w-3 h-3" />
                          ) : change < 0 ? (
                            <TrendingDown className="w-3 h-3" />
                          ) : null}
                          {change > 0 ? "+" : ""}
                          {change}%
                        </span>
                      )}
                      <span className="text-sm font-semibold text-[#1B2A4A] tabular-nums">
                        {formatCurrency(total, baseCurrency)}
                      </span>
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div className="h-1.5 rounded-full overflow-hidden bg-gray-100">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${widthPct}%`,
                        backgroundColor: color,
                      }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Top Merchants */}
      {topDescriptions.length > 0 && (
        <div className="rounded-2xl overflow-hidden bg-white shadow-sm border border-border">
          <div className="px-4 pt-4 pb-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Top Merchants
            </p>
          </div>
          <div className="divide-y divide-border">
            {topDescriptions.map(({ description, total }, i) => (
              <div key={description} className="flex items-center gap-3 px-4 py-3">
                <span
                  className="w-6 h-6 rounded-full flex items-center justify-center text-[0.625rem] font-bold shrink-0 bg-gray-100 text-muted-foreground"
                >
                  {i + 1}
                </span>
                <span className="text-sm text-[#1B2A4A] truncate flex-1">{description}</span>
                <span className="text-sm font-semibold text-[#1B2A4A] tabular-nums shrink-0">
                  {formatCurrency(total, baseCurrency)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
