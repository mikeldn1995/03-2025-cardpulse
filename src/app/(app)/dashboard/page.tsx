"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Calendar, Wifi, ChevronDown, ChevronRight, Minus, Plus, AlertTriangle } from "lucide-react"
import { useStore } from "@/lib/store"
import { useToast } from "@/components/toast"
import {
  fmt, utilPercent, utilColor, utilBarColor, getEffectiveAPR, getBalance,
  getGreeting, cn, getIssuerColor, getOpeningBalanceForMonth, estimateInterest,
  computeClosingBalance, currentMonth, getMissingMonths, ordinal,
} from "@/lib/utils"
import { CreditCard, MonthlyRecord } from "@/types/card"

interface TLCardBalance {
  accountId: string
  displayName: string
  cardNetwork: string
  partialNumber: string
  currency: string
  balance: { current: number; available: number; creditLimit: number } | null
}

export default function DashboardPage() {
  const { cards, currency, utilThreshold, userName, upsertRecord } = useStore()
  const { toast } = useToast()
  const router = useRouter()
  const cm = currentMonth()

  // Live balances from TrueLayer
  const [liveBalances, setLiveBalances] = useState<TLCardBalance[]>([])
  const [liveConnected, setLiveConnected] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const fetchLive = useCallback(() => {
    fetch("/api/truelayer/balances")
      .then(r => r.json())
      .then(d => {
        if (d.connected && d.cards) {
          setLiveConnected(true)
          setLiveBalances(d.cards)
        }
      })
      .catch(() => {})
      .finally(() => setRefreshing(false))
  }, [])

  useEffect(() => { fetchLive() }, [fetchLive])

  const handleRefresh = () => {
    setRefreshing(true)
    fetchLive()
  }

  // Build live balance map by last4
  const liveBalMap = new Map<number, { current: number; available: number; creditLimit: number }>()
  for (const card of cards) {
    const match = liveBalances.find(tc => tc.partialNumber && tc.partialNumber.endsWith(card.last4))
    if (match?.balance) liveBalMap.set(card.id, match.balance)
  }

  // Totals
  const totalBal = cards.reduce((s, c) => {
    const live = liveBalMap.get(c.id)
    return s + (live ? live.current : getBalance(c))
  }, 0)

  const totalLimit = cards.reduce((s, c) => {
    const live = liveBalMap.get(c.id)
    return s + (live ? live.creditLimit : c.limit)
  }, 0)

  // Last month interest (derived from records)
  const lastMonth = (() => {
    const d = new Date()
    d.setMonth(d.getMonth() - 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
  })()

  const lastMonthInterest = cards.reduce((s, c) => {
    const record = c.monthlyRecords.find(r => r.month === lastMonth)
    if (record) return s + record.interest
    // APR-based estimate if no record
    const opening = getBalance(c)
    return s + estimateInterest(opening, c)
  }, 0)

  // Min payment estimate for next month
  const totalMinPayment = cards.reduce((s, c) => {
    const bal = liveBalMap.get(c.id)?.current ?? getBalance(c)
    if (bal <= 0) return s
    if (c.dd === "full") return s + bal
    if (c.dd === "custom") return s + c.ddAmount
    return s + Math.max(bal * 0.05, Math.min(25, bal))
  }, 0)

  // Cards with payments due in next 7 days
  const now = new Date()
  const currentDay = now.getDate()
  const dueSoon = cards.filter(c => {
    const bal = liveBalMap.get(c.id)?.current ?? getBalance(c)
    if (bal <= 0) return false
    const dayDiff = c.paymentDay - currentDay
    return (dayDiff >= 0 && dayDiff <= 7) || (dayDiff < 0 && dayDiff + 30 <= 7)
  }).sort((a, b) => {
    const da = (a.paymentDay - currentDay + 30) % 30
    const db = (b.paymentDay - currentDay + 30) % 30
    return da - db
  })

  const noDDCards = dueSoon.filter(c => c.dd === "none")

  return (
    <>
      {/* Greeting */}
      <div className="pb-1">
        <p className="text-[0.8125rem] text-muted-foreground">{getGreeting(userName ? userName.split(" ")[0] : "there")}</p>
      </div>

      {/* Hero Total Balance */}
      <div className="py-4">
        <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-1">Total Balance</div>
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-bold tracking-tight tabular-nums">{fmt(totalBal, currency)}</span>
          {liveConnected && (
            <button onClick={handleRefresh} className="flex items-center gap-1">
              <Wifi className={cn("w-3 h-3 text-success", refreshing && "animate-pulse")} />
              <span className="text-[0.625rem] text-success font-medium">Live</span>
            </button>
          )}
        </div>
        {/* Subtitle chips */}
        <div className="flex items-center gap-3 mt-2">
          <div className="text-xs text-muted-foreground">
            Last month interest: <span className="font-semibold text-foreground">{fmt(lastMonthInterest, currency)}</span>
          </div>
          <div className="text-xs text-muted-foreground">
            Est. min payment: <span className="font-semibold text-foreground">{fmt(totalMinPayment, currency)}</span>
          </div>
        </div>
      </div>

      {/* Payment due alerts */}
      {dueSoon.length > 0 && (
        <div className={cn(
          "border rounded-lg p-3 mb-4",
          noDDCards.length > 0 ? "bg-warning/10 border-warning/30" : "bg-card border-border"
        )}>
          <div className="flex items-center gap-1.5 text-xs font-semibold mb-2">
            <Calendar className="w-3.5 h-3.5" />
            Payments Due Soon
          </div>
          <div className="space-y-1.5">
            {dueSoon.map(c => {
              const daysUntil = (c.paymentDay - currentDay + 30) % 30
              const bal = liveBalMap.get(c.id)?.current ?? getBalance(c)
              const minPay = c.dd === "full" ? bal : c.dd === "custom" ? c.ddAmount : Math.max(bal * 0.05, Math.min(25, bal))
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

      {/* Card Tiles */}
      {cards.length > 0 ? (
        <div className="space-y-2">
          {cards.map(card => (
            <CardTile
              key={card.id}
              card={card}
              currency={currency}
              liveBal={liveBalMap.get(card.id)}
              utilThreshold={utilThreshold}
              onNavigate={() => router.push(`/cards?highlight=${card.id}`)}
            />
          ))}
        </div>
      ) : (
        <div className="bg-card border border-border rounded-lg p-8 text-center">
          <div className="text-sm text-muted-foreground mb-3">No cards yet</div>
          <button
            onClick={() => router.push("/settings")}
            className="inline-flex items-center gap-1.5 py-2 px-4 text-xs font-medium bg-foreground text-background rounded-md hover:opacity-90 transition-opacity"
          >
            <Plus className="w-3.5 h-3.5" />
            Add your first card
          </button>
        </div>
      )}

      {/* Top Tip */}
      {cards.length >= 2 && <TopTip cards={cards} currency={currency} utilThreshold={utilThreshold} liveBalMap={liveBalMap} />}
    </>
  )
}

function CardTile({
  card, currency, liveBal, utilThreshold, onNavigate,
}: {
  card: CreditCard
  currency: string
  liveBal?: { current: number; available: number; creditLimit: number }
  utilThreshold: number
  onNavigate: () => void
}) {
  const balance = liveBal ? liveBal.current : getBalance(card)
  const limit = liveBal ? liveBal.creditLimit : card.limit
  const util = limit > 0 ? (balance / limit) * 100 : 0
  const issuerColor = getIssuerColor(card.issuer)
  const isLive = card.source === "truelayer" || !!liveBal

  return (
    <div
      className={cn("bg-card border rounded-lg px-4 py-3 cursor-pointer hover:border-ring/40 transition-colors", issuerColor.border)}
      onClick={onNavigate}
    >
      <div className="flex items-center gap-3">
        {/* Issuer dot */}
        <div className={cn("w-2.5 h-2.5 rounded-full shrink-0", utilBarColor(util))} />
        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-semibold truncate">{card.issuer}</span>
            <span className="text-xs text-muted-foreground font-mono">••{card.last4}</span>
            {isLive && <Wifi className="w-2.5 h-2.5 text-success shrink-0" />}
            {card.source === "manual" && !liveBal && (
              <span className="text-[0.5625rem] text-muted-foreground/60 uppercase tracking-wider">Manual</span>
            )}
          </div>
        </div>
        {/* Balance */}
        <div className="text-right shrink-0">
          <div className="text-sm font-semibold tabular-nums">{fmt(balance, currency)}</div>
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
      </div>
    </div>
  )
}

function TopTip({
  cards, currency, utilThreshold, liveBalMap,
}: {
  cards: CreditCard[]
  currency: string
  utilThreshold: number
  liveBalMap: Map<number, { current: number; available: number; creditLimit: number }>
}) {
  const router = useRouter()

  const getCardUtil = (c: CreditCard) => {
    const live = liveBalMap.get(c.id)
    const bal = live ? live.current : getBalance(c)
    const lim = live ? live.creditLimit : c.limit
    return lim > 0 ? (bal / lim) * 100 : 0
  }

  const eligible = cards.filter(c => getCardUtil(c) < utilThreshold).sort((a, b) => getEffectiveAPR(a) - getEffectiveAPR(b))
  const best = eligible[0] || [...cards].sort((a, b) => (getCardUtil(a) + getEffectiveAPR(a)) - (getCardUtil(b) + getEffectiveAPR(b)))[0]
  const worst = [...cards].sort((a, b) => (getCardUtil(b) + getEffectiveAPR(b)) - (getCardUtil(a) + getEffectiveAPR(a)))[0]

  if (!best || !worst) return null

  return (
    <div className="bg-card border border-border rounded-lg p-4 mt-4">
      <div className="flex items-center gap-2 text-[0.8125rem] font-semibold mb-3">
        <svg className="w-[18px] h-[18px] text-warning" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
        Top Tip
      </div>
      <div className="space-y-2">
        <div>
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">Use First</div>
          <div className="text-[0.8125rem] text-success cursor-pointer hover:underline"
            onClick={() => router.push(`/cards?highlight=${best.id}`)}>
            {best.issuer} ••{best.last4} — {getCardUtil(best).toFixed(1)}% util, {getEffectiveAPR(best)}% APR
          </div>
        </div>
        <div>
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">Avoid Using</div>
          <div className="text-[0.8125rem] text-destructive cursor-pointer hover:underline"
            onClick={() => router.push(`/cards?highlight=${worst.id}`)}>
            {worst.issuer} ••{worst.last4} — {getCardUtil(worst).toFixed(1)}% util, {getEffectiveAPR(worst)}% APR
          </div>
        </div>
      </div>
    </div>
  )
}
