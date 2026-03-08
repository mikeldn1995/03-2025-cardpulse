"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle, Calendar, Plus, ChevronDown, Wifi } from "lucide-react"
import { useStore } from "@/lib/store"
import { useToast } from "@/components/toast"
import { fmt, utilPercent, utilColor, utilBarColor, getEffectiveAPR, getBalance, getGreeting, cn, ordinal, getMissingMonths, currentMonth } from "@/lib/utils"

interface TLCardBalance {
  accountId: string
  displayName: string
  cardNetwork: string
  partialNumber: string
  currency: string
  balance: {
    current: number
    available: number
    creditLimit: number
  } | null
}

function StatCard({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={`bg-card border border-border rounded-lg p-4 ${full ? "col-span-2" : ""}`}>
      <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</div>
      {children}
    </div>
  )
}

export default function DashboardPage() {
  const { cards, currency, utilThreshold, userName, upsertStatement } = useStore()
  const { toast } = useToast()
  const router = useRouter()
  const cm = currentMonth()

  const [expenseOpen, setExpenseOpen] = useState(false)
  const [expenseAmount, setExpenseAmount] = useState("")
  const [expenseCardId, setExpenseCardId] = useState<number | null>(null)

  // Live balances from TrueLayer
  const [liveBalances, setLiveBalances] = useState<TLCardBalance[]>([])
  const [liveConnected, setLiveConnected] = useState(false)

  useEffect(() => {
    fetch("/api/truelayer/balances")
      .then(r => r.json())
      .then(d => {
        if (d.connected && d.cards) {
          setLiveConnected(true)
          setLiveBalances(d.cards)
        }
      })
      .catch(() => {})
  }, [])

  // Compute live total balance if connected
  const liveTotalBal = liveBalances.reduce((s, c) => s + (c.balance?.current ?? 0), 0)
  const liveTotalLimit = liveBalances.reduce((s, c) => s + (c.balance?.creditLimit ?? 0), 0)

  const totalBal = cards.reduce((s, c) => s + getBalance(c), 0)
  const totalLimit = cards.reduce((s, c) => s + c.limit, 0)
  const totalAvail = totalLimit - totalBal
  const totalUtil = totalLimit > 0 ? (totalBal / totalLimit) * 100 : 0

  // Expected interest this month: for each card, estimate based on current balance and effective APR
  const expectedInterest = cards.reduce((s, c) => {
    const bal = getBalance(c)
    if (bal <= 0) return s
    const apr = getEffectiveAPR(c)
    return s + bal * (apr / 100 / 12)
  }, 0)

  // Weighted average effective APR (weighted by balance)
  const avgAPR = totalBal > 0
    ? cards.reduce((s, c) => s + getEffectiveAPR(c) * getBalance(c), 0) / totalBal
    : 0

  // Minimum payment due this month (5% of balance or £25, whichever is greater; custom DD amounts where set)
  const totalMinPayment = cards.reduce((s, c) => {
    const bal = getBalance(c)
    if (bal <= 0) return s
    if (c.dd === "custom") return s + c.ddAmount
    return s + Math.max(bal * 0.05, Math.min(25, bal))
  }, 0)

  // Highest utilization
  let highUtil = 0, highCard = ""
  cards.forEach(c => {
    const u = utilPercent(c)
    if (u > highUtil) { highUtil = u; highCard = `${c.issuer} ••${c.last4}` }
  })

  // Cards with payments due in next 7 days
  const now = new Date()
  const currentDay = now.getDate()
  const dueSoon = cards.filter(c => {
    const bal = getBalance(c)
    if (bal <= 0) return false
    const dayDiff = c.paymentDay - currentDay
    return (dayDiff >= 0 && dayDiff <= 7) || (dayDiff < 0 && dayDiff + 30 <= 7)
  }).sort((a, b) => {
    const da = (a.paymentDay - currentDay + 30) % 30
    const db = (b.paymentDay - currentDay + 30) % 30
    return da - db
  })

  const noDDCards = dueSoon.filter(c => c.dd === "none")

  // Missing statements across all cards (exclude current month from warnings)
  const cardsWithMissing = cards.map(c => {
    const missing = getMissingMonths(c).filter(m => m !== cm)
    return { card: c, missing }
  }).filter(x => x.missing.length > 0)
  const totalMissing = cardsWithMissing.reduce((s, x) => s + x.missing.length, 0)

  // Top Tip logic
  const eligible = cards.filter(c => utilPercent(c) < utilThreshold).sort((a, b) => getEffectiveAPR(a) - getEffectiveAPR(b))
  const best = eligible[0] || [...cards].sort((a, b) => (utilPercent(a) + getEffectiveAPR(a)) - (utilPercent(b) + getEffectiveAPR(b)))[0]
  const worst = [...cards].sort((a, b) => (utilPercent(b) + getEffectiveAPR(b)) - (utilPercent(a) + getEffectiveAPR(a)))[0]
  const above = cards.filter(c => utilPercent(c) >= utilThreshold).sort((a, b) => utilPercent(b) - utilPercent(a))

  const handleAddExpense = () => {
    const amount = parseFloat(expenseAmount)
    if (isNaN(amount) || amount <= 0 || !expenseCardId) return
    const card = cards.find(c => c.id === expenseCardId)
    if (!card) return

    const existing = card.statements.find(s => s.month === cm)
    if (existing) {
      upsertStatement(card.id, { ...existing, spent: existing.spent + amount })
    } else {
      // Create current month statement with estimated interest
      const bal = getBalance(card)
      const isPromo = card.aprPromo !== null && card.promoUntil && new Date(card.promoUntil) > new Date(cm + "-28")
      const apr = isPromo ? card.aprPromo! : card.aprRegular
      const interest = Math.round(bal * (apr / 100 / 12) * 100) / 100
      upsertStatement(card.id, { month: cm, spent: amount, paid: 0, interest, source: "manual" })
    }

    toast(`${fmt(amount, currency)} added to ${card.issuer}`)
    setExpenseAmount("")
    setExpenseOpen(false)
  }

  return (
    <>
      <div className="pb-3">
        <p className="text-[0.8125rem] text-muted-foreground">{getGreeting(userName ? userName.split(" ")[0] : "there")}</p>
      </div>

      {/* Add Expense */}
      <div className="bg-card border border-border rounded-lg overflow-hidden mb-3">
        <button
          onClick={() => setExpenseOpen(!expenseOpen)}
          className="w-full flex items-center justify-between px-4 py-3 text-[0.8125rem] font-semibold"
        >
          <div className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Add Expense
          </div>
          <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", expenseOpen && "rotate-180")} />
        </button>
        {expenseOpen && (
          <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
            <div>
              <label className="block text-[0.6875rem] uppercase tracking-wider text-muted-foreground font-medium mb-1.5">Card</label>
              <select
                value={expenseCardId ?? ""}
                onChange={e => setExpenseCardId(e.target.value ? parseInt(e.target.value) : null)}
                className="w-full h-9 px-2.5 text-sm bg-background border border-border rounded-md outline-none focus:border-ring"
              >
                <option value="">Select a card...</option>
                {cards.map(c => (
                  <option key={c.id} value={c.id}>{c.issuer} ••{c.last4}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[0.6875rem] uppercase tracking-wider text-muted-foreground font-medium mb-1.5">Amount</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={expenseAmount}
                onChange={e => setExpenseAmount(e.target.value)}
                placeholder="0.00"
                className="w-full h-9 px-2.5 text-sm bg-background border border-border rounded-md outline-none focus:border-ring tabular-nums"
              />
            </div>
            <button
              onClick={handleAddExpense}
              disabled={!expenseCardId || !expenseAmount || parseFloat(expenseAmount) <= 0}
              className="w-full h-9 bg-foreground text-background rounded-md text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40"
            >
              Add to {cards.find(c => c.id === expenseCardId)?.issuer || "card"}
            </button>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <StatCard label="Total Balance">
          {liveConnected ? (
            <>
              <div className="text-2xl font-bold tracking-tight mt-1">{fmt(liveTotalBal, currency)}</div>
              <div className="flex items-center gap-1 mt-0.5">
                <Wifi className="w-2.5 h-2.5 text-success" />
                <span className="text-[0.625rem] text-success font-medium">Live</span>
              </div>
            </>
          ) : (
            <div className="text-2xl font-bold tracking-tight mt-1">{fmt(totalBal, currency)}</div>
          )}
        </StatCard>
        <StatCard label="Available Credit">
          <div className="text-2xl font-bold tracking-tight mt-1">
            {fmt(liveConnected ? (liveTotalLimit - liveTotalBal) : totalAvail, currency)}
          </div>
          {liveConnected && (
            <div className="flex items-center gap-1 mt-0.5">
              <Wifi className="w-2.5 h-2.5 text-success" />
              <span className="text-[0.625rem] text-success font-medium">Live</span>
            </div>
          )}
        </StatCard>
        <StatCard label="Total Utilization">
          <div className="mt-1.5">
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div className={cn("h-full rounded-full transition-all", utilBarColor(totalUtil))} style={{ width: `${Math.min(totalUtil, 100)}%` }} />
            </div>
            <div className={`text-lg font-bold tracking-tight mt-1 ${utilColor(totalUtil)}`}>{totalUtil.toFixed(1)}%</div>
          </div>
        </StatCard>
        <StatCard label="Avg Effective APR">
          <div className="text-2xl font-bold tracking-tight mt-1">
            {avgAPR.toFixed(1)}%
          </div>
          <div className="text-[0.6875rem] text-muted-foreground mt-0.5">weighted by balance</div>
        </StatCard>
        <StatCard label="Min Payment Due">
          <div className="text-2xl font-bold tracking-tight mt-1">{fmt(totalMinPayment, currency)}</div>
          <div className="text-[0.6875rem] text-muted-foreground mt-0.5">this month</div>
        </StatCard>
        <StatCard label="Expected Interest">
          <div className="text-2xl font-bold tracking-tight mt-1">{fmt(expectedInterest, currency)}</div>
          <div className="text-[0.6875rem] text-muted-foreground mt-0.5">this month</div>
        </StatCard>
        <StatCard label="Highest Utilization" full>
          <div className="flex items-center justify-between mt-1">
            <div className={`text-lg font-bold tracking-tight ${utilColor(highUtil)}`}>{highUtil.toFixed(1)}%</div>
            <div className="text-xs text-muted-foreground">{highCard}</div>
          </div>
        </StatCard>
      </div>

      {/* Payment due warning */}
      {dueSoon.length > 0 && (
        <div className={cn(
          "border rounded-lg p-3 mb-3",
          noDDCards.length > 0 ? "bg-warning/10 border-warning/30" : "bg-card border-border"
        )}>
          <div className="flex items-center gap-1.5 text-xs font-semibold mb-2">
            <Calendar className="w-3.5 h-3.5" />
            Payments Due Soon
          </div>
          <div className="space-y-1.5">
            {dueSoon.map(c => {
              const daysUntil = (c.paymentDay - currentDay + 30) % 30
              const bal = getBalance(c)
              const minPay = c.dd === "custom" ? c.ddAmount : Math.max(bal * 0.05, Math.min(25, bal))
              return (
                <div key={c.id} className="flex items-center justify-between text-[0.8125rem] cursor-pointer hover:bg-accent/50 -mx-1.5 px-1.5 py-0.5 rounded"
                  onClick={() => router.push(`/cards?highlight=${c.id}`)}>
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="font-medium truncate">{c.issuer}</span>
                    <span className="text-muted-foreground text-xs">••{c.last4}</span>
                    {c.dd === "none" && (
                      <span className="text-[0.625rem] bg-warning/20 text-warning px-1 py-px rounded font-medium shrink-0">No DD</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-muted-foreground">
                      {daysUntil === 0 ? "Today" : daysUntil === 1 ? "Tomorrow" : `${daysUntil}d`}
                    </span>
                    <span className="text-xs font-semibold tabular-nums">{fmt(minPay, currency)}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Missing statements warning */}
      {totalMissing > 0 && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 mb-3 cursor-pointer hover:bg-destructive/15 transition-colors"
          onClick={() => router.push("/cards")}>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-destructive mb-1">
            <AlertTriangle className="w-3.5 h-3.5" />
            {totalMissing} Missing Statement{totalMissing !== 1 ? "s" : ""}
          </div>
          <div className="space-y-0.5">
            {cardsWithMissing.map(({ card: c, missing }) => (
              <div key={c.id} className="text-[0.75rem] text-muted-foreground">
                {c.issuer} ••{c.last4} — {missing.length} gap{missing.length !== 1 ? "s" : ""}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top Tip */}
      {best && worst && (
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 text-[0.8125rem] font-semibold mb-3">
            <svg className="w-[18px] h-[18px] text-warning" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
            Top Tip
          </div>
          <div className="space-y-3">
            <div>
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">Use First</div>
              <div className="text-[0.8125rem] text-success cursor-pointer hover:underline"
                onClick={() => router.push(`/cards?highlight=${best.id}`)}>
                {best.issuer} ••{best.last4} — {utilPercent(best).toFixed(1)}% util, {getEffectiveAPR(best)}% APR{best.aprPromo !== null ? " (promo)" : ""}
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">Avoid Using</div>
              <div className="text-[0.8125rem] text-destructive cursor-pointer hover:underline"
                onClick={() => router.push(`/cards?highlight=${worst.id}`)}>
                {worst.issuer} ••{worst.last4} — {utilPercent(worst).toFixed(1)}% util, {getEffectiveAPR(worst)}% APR
              </div>
            </div>
            {above.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">Above {utilThreshold}% Utilization</div>
                <div className="text-[0.8125rem] text-warning space-y-0.5">
                  {above.map(c => (
                    <div key={c.id} className="cursor-pointer hover:underline"
                      onClick={() => router.push(`/cards?highlight=${c.id}`)}>
                      {c.issuer} ••{c.last4} ({utilPercent(c).toFixed(1)}%)
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
