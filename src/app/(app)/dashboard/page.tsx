"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Wifi, ChevronRight, Plus, AlertTriangle } from "lucide-react"
import { useStore } from "@/lib/store"
import {
  fmt, utilBarColor, getBalance, getGreeting, cn, getIssuerColor,
  currentMonth, calcMinPayment, needsAttention, estimateInterest, ordinal,
} from "@/lib/utils"
import { CreditCard } from "@/types/card"

interface TLCardBalance {
  accountId: string
  displayName: string
  cardNetwork: string
  partialNumber: string
  currency: string
  balance: { current: number; available: number; creditLimit: number } | null
}

interface ActionItem {
  id: string
  cardId: number
  type: "manual-update" | "payment-dd" | "payment-nodd" | "high-util" | "promo-expiring"
  label: string
}

export default function DashboardPage() {
  const { cards, currency, utilThreshold, userName } = useStore()
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

  // Total balance (live + manual combined)
  const totalBal = cards.reduce((s, c) => {
    const live = liveBalMap.get(c.id)
    return s + (live ? live.current : getBalance(c))
  }, 0)

  // Last month interest
  const lastMonth = (() => {
    const d = new Date()
    d.setMonth(d.getMonth() - 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
  })()

  const lastMonthInterest = cards.reduce((s, c) => {
    const record = c.monthlyRecords.find(r => r.month === lastMonth)
    if (record) return s + record.interest
    const opening = getBalance(c)
    return s + estimateInterest(opening, c)
  }, 0)

  // Estimated total min payment
  const totalMinPayment = cards.reduce((s, c) => {
    const bal = liveBalMap.get(c.id)?.current ?? getBalance(c)
    return s + calcMinPayment(c, bal)
  }, 0)

  // Month label for display (e.g. "March")
  const currentMonthLabel = new Date().toLocaleString("en-GB", { month: "long" })

  // Build action-needed items
  const now = new Date()
  const currentDay = now.getDate()
  const actions: ActionItem[] = []

  // Manual cards needing monthly update
  const manualCardsNeedingUpdate = cards.filter(c => {
    if (c.source !== "manual") return false
    // Check if statement day has passed and no record for current month
    const hasCurrentRecord = c.monthlyRecords.some(r => r.month === cm)
    return currentDay > c.statementDay && !hasCurrentRecord
  })

  if (manualCardsNeedingUpdate.length > 0) {
    actions.push({
      id: "manual-update",
      cardId: manualCardsNeedingUpdate[0].id,
      type: "manual-update",
      label: `${manualCardsNeedingUpdate.length} manual card${manualCardsNeedingUpdate.length > 1 ? "s" : ""} need${manualCardsNeedingUpdate.length === 1 ? "s" : ""} updating for ${currentMonthLabel}`,
    })
  }

  // Payment due alerts
  for (const c of cards) {
    const bal = liveBalMap.get(c.id)?.current ?? getBalance(c)
    if (bal <= 0) continue
    const dayDiff = (c.paymentDay - currentDay + 30) % 30
    if (dayDiff > 7) continue

    const minPay = calcMinPayment(c, bal)
    const payDate = ordinal(c.paymentDay)
    const payMonth = (() => {
      const d = new Date()
      if (c.paymentDay >= currentDay) return d.toLocaleString("en-GB", { month: "short" })
      d.setMonth(d.getMonth() + 1)
      return d.toLocaleString("en-GB", { month: "short" })
    })()

    if (c.dd !== "none") {
      const ddLabel = c.dd === "full" ? "Full" : c.dd === "custom" ? "Custom" : "DD"
      actions.push({
        id: `pay-dd-${c.id}`,
        cardId: c.id,
        type: "payment-dd",
        label: `${c.issuer} DD: ${fmt(minPay, currency)} min on ${payDate} ${payMonth}`,
      })
    } else {
      actions.push({
        id: `pay-nodd-${c.id}`,
        cardId: c.id,
        type: "payment-nodd",
        label: `${c.issuer}: no DD set -- ${fmt(minPay, currency)} min due ${payDate} ${payMonth}`,
      })
    }
  }

  // High utilization warnings
  for (const c of cards) {
    const live = liveBalMap.get(c.id)
    const bal = live ? live.current : getBalance(c)
    const limit = live ? live.creditLimit : c.limit
    const util = limit > 0 ? (bal / limit) * 100 : 0
    if (util >= utilThreshold) {
      actions.push({
        id: `util-${c.id}`,
        cardId: c.id,
        type: "high-util",
        label: `${c.issuer} ••${c.last4}: utilization at ${Math.round(util)}% (above ${utilThreshold}% threshold)`,
      })
    }
  }

  // Promo expiring within 30 days
  for (const c of cards) {
    if (c.aprPromo === null || !c.promoUntil) continue
    const expiry = new Date(c.promoUntil)
    const daysToExpiry = Math.ceil((expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    if (daysToExpiry > 0 && daysToExpiry <= 30) {
      actions.push({
        id: `promo-${c.id}`,
        cardId: c.id,
        type: "promo-expiring",
        label: `${c.issuer} ••${c.last4}: promo rate expires in ${daysToExpiry} day${daysToExpiry === 1 ? "" : "s"}`,
      })
    }
  }

  // Has any warnings (payment-nodd or high-util)
  const hasWarnings = actions.some(a => a.type === "payment-nodd" || a.type === "high-util")

  // Empty state
  if (cards.length === 0) {
    return (
      <>
        <div className="pb-1">
          <p className="text-[0.8125rem] text-muted-foreground">{getGreeting(userName ? userName.split(" ")[0] : "there")}</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-8 text-center mt-4">
          <div className="text-sm text-muted-foreground mb-3">Add your first card to get started</div>
          <button
            onClick={() => router.push("/settings")}
            className="inline-flex items-center gap-1.5 py-2 px-4 text-xs font-medium bg-foreground text-background rounded-md hover:opacity-90 transition-opacity"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Card
          </button>
        </div>
      </>
    )
  }

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

      {/* Action Needed */}
      {actions.length > 0 && (
        <div className={cn(
          "border rounded-lg p-3 mb-4",
          hasWarnings ? "bg-warning/10 border-warning/30" : "bg-card border-border"
        )}>
          <div className="flex items-center gap-1.5 text-xs font-semibold mb-2">
            <AlertTriangle className={cn("w-3.5 h-3.5", hasWarnings ? "text-warning" : "text-muted-foreground")} />
            Action needed
          </div>
          <div className="space-y-1.5">
            {actions.map(action => (
              <div
                key={action.id}
                className="flex items-center justify-between text-[0.8125rem] cursor-pointer hover:bg-accent/50 -mx-1.5 px-1.5 py-0.5 rounded"
                onClick={() => router.push(`/cards?highlight=${action.cardId}`)}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  {action.type === "payment-nodd" && (
                    <span className="text-[0.625rem] bg-warning/20 text-warning px-1 py-px rounded font-medium shrink-0">No DD</span>
                  )}
                  <span className={cn(
                    "truncate",
                    action.type === "payment-nodd" || action.type === "high-util"
                      ? "text-warning"
                      : "text-foreground"
                  )}>{action.label}</span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0 ml-2" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Card Tiles */}
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
  const isLive = card.source === "truelayer" || !!liveBal
  const alerts = needsAttention(card, utilThreshold, liveBal ? { current: liveBal.current, creditLimit: liveBal.creditLimit } : undefined)
  const hasAlert = alerts.length > 0

  return (
    <div
      className="bg-card border border-border rounded-lg px-4 py-3 cursor-pointer hover:border-ring/40 transition-colors"
      onClick={onNavigate}
    >
      <div className="flex items-center gap-3">
        {/* Utilization dot */}
        <div className={cn("w-2.5 h-2.5 rounded-full shrink-0", utilBarColor(util))} />
        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-semibold truncate">{card.issuer}</span>
            <span className="text-xs text-muted-foreground font-mono">••{card.last4}</span>
            {isLive && <Wifi className="w-2.5 h-2.5 text-success shrink-0" />}
            {hasAlert && <div className="w-1.5 h-1.5 rounded-full bg-warning shrink-0" />}
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
