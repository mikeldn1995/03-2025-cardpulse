"use client"

import { useState, useEffect, useRef } from "react"
import { ChevronLeft, ChevronRight, Download, Printer } from "lucide-react"
import { Logo } from "@/components/logo"

interface DigestData {
  monthName: string
  year: number
  month: number
  netWorth: number
  totalDebt: number
  totalIncome: number
  totalSpending: number
  savingsRate: number
  healthScore: number
  accountSummaries: {
    id: number
    institution: string
    accountName: string
    category: string
    balance: number
    currency: string
    prevBalance: number | null
    change: number | null
  }[]
  categorySpending: {
    category: string
    amount: number
    prevAmount: number
    change: number | null
  }[]
  topMerchants: { name: string; count: number; total: number }[]
  transferCount: number
  forecastPayoffMonth: number | null
  forecastTotalInterest: number
  transactionCount: number
  userName: string
}

function fmt(n: number, currency = "GBP") {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(n)
}

function healthLabel(score: number) {
  if (score >= 80) return "Excellent"
  if (score >= 60) return "Good"
  if (score >= 40) return "Fair"
  return "Needs Attention"
}

function healthColor(score: number) {
  if (score >= 80) return "#22c55e"
  if (score >= 60) return "#3b82f6"
  if (score >= 40) return "#f59e0b"
  return "#ef4444"
}

export default function DigestPage() {
  const [data, setData] = useState<DigestData | null>(null)
  const [loading, setLoading] = useState(true)
  const [year, setYear] = useState(new Date().getFullYear())
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const printRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/digest?year=${year}&month=${month}`)
      .then((r) => r.json())
      .then((d) => {
        setData(d)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [year, month])

  const goPrev = () => {
    if (month === 1) {
      setMonth(12)
      setYear(year - 1)
    } else {
      setMonth(month - 1)
    }
  }

  const goNext = () => {
    if (month === 12) {
      setMonth(1)
      setYear(year + 1)
    } else {
      setMonth(month + 1)
    }
  }

  const handlePrint = () => window.print()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-pulse text-white/40">Generating digest...</div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-white/40">Unable to load digest data.</p>
      </div>
    )
  }

  const maxCatSpend = data.categorySpending.length > 0 ? data.categorySpending[0].amount : 1

  return (
    <>
      {/* Screen controls (hidden in print) */}
      <div className="print:hidden flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <button onClick={goPrev} className="p-2 rounded-xl bg-[#1B2A4A] text-white/60">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-white font-medium text-sm min-w-[140px] text-center">
            {data.monthName}
          </span>
          <button onClick={goNext} className="p-2 rounded-xl bg-[#1B2A4A] text-white/60">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 px-4 py-2 bg-[hsl(217,70%,50%)] text-white rounded-xl text-sm font-medium"
        >
          <Printer className="w-4 h-4" />
          Save as PDF
        </button>
      </div>

      {/* Printable digest */}
      <div ref={printRef} className="digest-page space-y-5">
        {/* Header */}
        <div className="bg-[#1B2A4A] rounded-2xl p-6 print:bg-[#0A1628] print:border print:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Logo size={32} variant="dark" />
              <div>
                <h1 className="text-white font-bold text-lg">CardPulse</h1>
                <p className="text-white/40 text-xs">Monthly Financial Digest</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-white font-semibold text-sm">{data.monthName}</p>
              <p className="text-white/40 text-xs">Prepared for {data.userName}</p>
            </div>
          </div>

          {/* Health Score */}
          <div className="flex items-center gap-5 mt-4">
            <div className="relative w-20 h-20 shrink-0">
              <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                <circle
                  cx="50" cy="50" r="42"
                  fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="8"
                />
                <circle
                  cx="50" cy="50" r="42"
                  fill="none"
                  stroke={healthColor(data.healthScore)}
                  strokeWidth="8"
                  strokeDasharray={`${(data.healthScore / 100) * 264} 264`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-white font-bold text-lg">{data.healthScore}</span>
              </div>
            </div>
            <div>
              <p className="text-white/60 text-xs uppercase tracking-wider">Financial Health</p>
              <p className="text-white font-semibold text-base" style={{ color: healthColor(data.healthScore) }}>
                {healthLabel(data.healthScore)}
              </p>
              <p className="text-white/40 text-xs mt-1">
                {data.savingsRate > 0 ? `${data.savingsRate}% savings rate` : "No savings this month"}
              </p>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-3">
          <SummaryCard label="Net Worth" value={fmt(data.netWorth)} color="#3b82f6" />
          <SummaryCard label="Total Debt" value={fmt(data.totalDebt)} color={data.totalDebt > 0 ? "#ef4444" : "#22c55e"} />
          <SummaryCard label="Income" value={fmt(data.totalIncome)} color="#22c55e" />
          <SummaryCard label="Spending" value={fmt(data.totalSpending)} color="#f59e0b" />
        </div>

        {/* Account Balances */}
        <Section title="Account Balances">
          <div className="space-y-2">
            {data.accountSummaries.map((a) => (
              <div key={a.id} className="flex items-center justify-between py-1.5">
                <div className="min-w-0 flex-1">
                  <p className="text-white text-sm truncate">
                    {a.institution} {a.accountName}
                  </p>
                  <p className="text-white/30 text-xs capitalize">
                    {a.category.replace("_", " ")}
                  </p>
                </div>
                <div className="text-right shrink-0 ml-3">
                  <p className="text-white text-sm font-medium">{fmt(a.balance, a.currency)}</p>
                  {a.change != null && (
                    <p className={`text-xs ${a.change >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {a.change >= 0 ? "+" : ""}{fmt(a.change, a.currency)}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
          {data.accountSummaries.length === 0 && (
            <p className="text-white/30 text-sm text-center py-4">No accounts found</p>
          )}
        </Section>

        {/* Spending by Category */}
        <Section title="Spending by Category">
          <div className="space-y-2.5">
            {data.categorySpending.map((c) => (
              <div key={c.category}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-white/80 text-sm">{c.category}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-white text-sm font-medium">{fmt(c.amount)}</span>
                    {c.change != null && (
                      <span
                        className={`text-xs ${c.change <= 0 ? "text-green-400" : "text-red-400"}`}
                      >
                        {c.change > 0 ? "+" : ""}{c.change}%
                      </span>
                    )}
                  </div>
                </div>
                <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[hsl(217,70%,50%)] rounded-full transition-all"
                    style={{ width: `${(c.amount / maxCatSpend) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          {data.categorySpending.length === 0 && (
            <p className="text-white/30 text-sm text-center py-4">No spending this month</p>
          )}
        </Section>

        {/* Top Merchants */}
        <Section title="Top Merchants">
          <div className="space-y-1.5">
            {data.topMerchants.map((m, i) => (
              <div key={m.name} className="flex items-center justify-between py-1">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className="text-white/30 text-xs w-5 shrink-0">{i + 1}.</span>
                  <span className="text-white/80 text-sm truncate">{m.name}</span>
                </div>
                <div className="text-right shrink-0 ml-3">
                  <span className="text-white text-sm font-medium">{fmt(m.total)}</span>
                  <span className="text-white/30 text-xs ml-2">x{m.count}</span>
                </div>
              </div>
            ))}
          </div>
          {data.topMerchants.length === 0 && (
            <p className="text-white/30 text-sm text-center py-4">No transactions this month</p>
          )}
        </Section>

        {/* Debt Forecast */}
        {data.totalDebt > 0 && (
          <Section title="Debt Forecast">
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-white/60 text-sm">Current total debt</span>
                <span className="text-white text-sm font-medium">{fmt(data.totalDebt)}</span>
              </div>
              {data.forecastPayoffMonth != null && (
                <div className="flex justify-between">
                  <span className="text-white/60 text-sm">Est. payoff (min payments)</span>
                  <span className="text-white text-sm font-medium">{data.forecastPayoffMonth} months</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-white/60 text-sm">Est. total interest</span>
                <span className="text-red-400 text-sm font-medium">{fmt(data.forecastTotalInterest)}</span>
              </div>
            </div>
          </Section>
        )}

        {/* Month Summary Stats */}
        <Section title="Month at a Glance">
          <div className="grid grid-cols-2 gap-3">
            <MiniStat label="Transactions" value={String(data.transactionCount)} />
            <MiniStat label="Transfers" value={String(data.transferCount)} />
            <MiniStat label="Accounts" value={String(data.accountSummaries.length)} />
            <MiniStat
              label="Net Cash Flow"
              value={fmt(data.totalIncome - data.totalSpending)}
              color={data.totalIncome >= data.totalSpending ? "#22c55e" : "#ef4444"}
            />
          </div>
        </Section>

        {/* Notes Section (blank for user to fill in) */}
        <Section title="Notes & Cash Transactions">
          <div className="space-y-4">
            <p className="text-white/30 text-xs italic">
              Use this section to record any cash transactions, receipts, or notes not captured in your statements.
            </p>
            <div className="space-y-3 print:space-y-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div
                  key={i}
                  className="border-b border-white/10 pb-2 print:pb-4 print:border-gray-600"
                >
                  <div className="flex gap-4 text-white/20 text-xs">
                    <span className="w-20">Date: _____</span>
                    <span className="flex-1">Description: ___________________________</span>
                    <span className="w-20">Amount: ____</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Section>

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 pb-6 print:pb-0">
          <div className="flex items-center gap-2">
            <Logo size={16} variant="dark" />
            <span className="text-white/20 text-xs">CardPulse v4.0</span>
          </div>
          <p className="text-white/20 text-xs">
            Generated {new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
      </div>

      {/* Print-specific styles */}
      <style jsx global>{`
        @media print {
          body {
            background: #0A1628 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .print\\:hidden,
          nav,
          header,
          [data-bottom-nav] {
            display: none !important;
          }
          .digest-page {
            padding: 0 !important;
            max-width: 100% !important;
          }
          @page {
            margin: 1cm;
            size: A4;
          }
        }
      `}</style>
    </>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-[#1B2A4A] rounded-2xl p-5 print:bg-[#0A1628] print:border print:border-gray-700">
      <h2 className="text-white font-semibold text-sm mb-3 uppercase tracking-wider opacity-60">
        {title}
      </h2>
      {children}
    </div>
  )
}

function SummaryCard({
  label,
  value,
  color,
}: {
  label: string
  value: string
  color: string
}) {
  return (
    <div className="bg-[#1B2A4A] rounded-2xl p-4 print:bg-[#0A1628] print:border print:border-gray-700">
      <p className="text-white/40 text-xs mb-1">{label}</p>
      <p className="text-lg font-bold" style={{ color }}>
        {value}
      </p>
    </div>
  )
}

function MiniStat({
  label,
  value,
  color = "white",
}: {
  label: string
  value: string
  color?: string
}) {
  return (
    <div className="text-center py-2">
      <p style={{ color }} className="text-base font-bold">
        {value}
      </p>
      <p className="text-white/30 text-xs">{label}</p>
    </div>
  )
}
