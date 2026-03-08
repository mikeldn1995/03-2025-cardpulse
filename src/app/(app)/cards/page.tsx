"use client"

import { useState, useEffect, useRef, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { ChevronDown, Trash2, AlertTriangle, X, RefreshCw, ArrowUpDown, Wifi, Minus, Plus } from "lucide-react"
import { useStore } from "@/lib/store"
import { useToast } from "@/components/toast"
import { InlineEdit } from "@/components/ui/inline-edit"
import {
  fmt, utilPercent, utilColor, utilBarColor, getEffectiveAPR, getBalance,
  ordinal, formatDate, cn, currencySymbol, getMissingMonths, currentMonth,
  getIssuerColor, getOpeningBalanceForMonth, estimateInterest, computeClosingBalance,
  deriveInterest, needsAttention, calcMinPayment,
} from "@/lib/utils"
import { CreditCard, MonthlyRecord } from "@/types/card"

function formatMonthLabel(m: string): string {
  const [y, mo] = m.split("-")
  const d = new Date(parseInt(y), parseInt(mo) - 1)
  return d.toLocaleDateString("en-GB", { month: "short", year: "numeric" })
}

/** Compact month row for monthly history — collapsed by default */
function MonthRow({ record, card, currency, isCurrentMonth, onUpdate, onDelete }: {
  record: MonthlyRecord
  card: CreditCard
  currency: string
  isCurrentMonth?: boolean
  onUpdate: (updates: Partial<MonthlyRecord>) => void
  onDelete: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const [overrideMode, setOverrideMode] = useState(false)
  const opening = getOpeningBalanceForMonth(card, record.month)
  const derivedInterest = deriveInterest(card, record)
  const derivedClosing = computeClosingBalance(opening, record.debits, record.credits, derivedInterest)

  return (
    <div className={cn("rounded-md overflow-hidden", isCurrentMonth ? "bg-primary/5 border border-primary/20" : "bg-secondary/50")}>
      {/* Compact summary row — tap to expand */}
      <div
        className="flex items-center justify-between px-3 py-2 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="text-xs font-semibold flex items-center gap-1.5">
          {formatMonthLabel(record.month)}
          {isCurrentMonth && <span className="text-[0.625rem] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium">Current</span>}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium tabular-nums">{fmt(record.closingBalance, currency)}</span>
          <ChevronDown className={cn("w-3 h-3 text-muted-foreground transition-transform", expanded && "rotate-180")} />
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-3 pb-2.5 border-t border-border/50">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs pt-2">
            <div>
              <div className="text-muted-foreground mb-0.5">Debits (spending)</div>
              <InlineEdit
                value={record.debits}
                displayValue={fmt(record.debits, currency)}
                type="number"
                step="0.01"
                onSave={v => { const n = parseFloat(v); if (!isNaN(n)) onUpdate({ debits: n }) }}
                inputClassName="w-20"
              />
            </div>
            <div>
              <div className="text-muted-foreground mb-0.5">Credits (payments)</div>
              <InlineEdit
                value={record.credits}
                displayValue={fmt(record.credits, currency)}
                type="number"
                step="0.01"
                onSave={v => { const n = parseFloat(v); if (!isNaN(n)) onUpdate({ credits: n }) }}
                inputClassName="w-20"
              />
            </div>
            <div>
              <div className="text-muted-foreground mb-0.5">
                Interest <span className="italic opacity-60">{overrideMode ? "(back-calculated)" : "(derived)"}</span>
              </div>
              <span className="text-sm font-medium">{fmt(overrideMode ? deriveInterest(card, record) : derivedInterest, currency)}</span>
            </div>
            <div>
              <div className="text-muted-foreground mb-0.5 flex items-center gap-1.5">
                Closing Balance
                <button
                  onClick={e => { e.stopPropagation(); setOverrideMode(!overrideMode) }}
                  className={cn(
                    "text-[0.5625rem] px-1 py-px rounded border transition-colors",
                    overrideMode ? "bg-primary/10 text-primary border-primary/30" : "text-muted-foreground border-border hover:border-ring"
                  )}
                >
                  Override
                </button>
              </div>
              {overrideMode ? (
                <InlineEdit
                  value={record.closingBalance}
                  displayValue={fmt(record.closingBalance, currency)}
                  type="number"
                  step="0.01"
                  onSave={v => {
                    const n = parseFloat(v)
                    if (!isNaN(n)) {
                      // Back-calculate interest: interest = closing - opening - debits + credits
                      const backCalcInterest = n - opening - record.debits + record.credits
                      onUpdate({ closingBalance: n, interest: Math.max(0, Math.round(backCalcInterest * 100) / 100) })
                    }
                  }}
                  inputClassName="w-24"
                />
              ) : (
                <span className="text-sm font-medium">{fmt(derivedClosing, currency)}</span>
              )}
            </div>
          </div>
          <div className="flex justify-end mt-2 pt-1.5 border-t border-border/30">
            {confirmDel ? (
              <div className="flex items-center gap-1">
                <button onClick={() => onDelete()} className="text-[0.625rem] text-destructive font-medium underline">Delete</button>
                <button onClick={() => setConfirmDel(false)} className="text-[0.625rem] text-muted-foreground underline">Cancel</button>
              </div>
            ) : (
              <button onClick={() => setConfirmDel(true)}
                className="w-5 h-5 flex items-center justify-center text-muted-foreground hover:text-destructive rounded transition-colors">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

type SortKey = "default" | "due" | "balance" | "utilization" | "apr"

interface LiveBal { current: number; available: number; creditLimit: number }

function CardItem({ card, autoExpand, liveBal, alerts }: { card: CreditCard; autoExpand?: boolean; liveBal?: LiveBal | null; alerts: string[] }) {
  const { updateCard, deleteCard, upsertRecord, deleteRecord, currency } = useStore()
  const { toast } = useToast()
  const [expanded, setExpanded] = useState(autoExpand || false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)

  const balance = liveBal ? liveBal.current : getBalance(card)
  const limit = liveBal ? liveBal.creditLimit : card.limit
  const util = limit > 0 ? (balance / limit) * 100 : 0
  const cm = currentMonth()
  const allMissing = getMissingMonths(card)
  const pastMissing = allMissing.filter(m => m !== cm)
  const effectiveAPR = getEffectiveAPR(card)
  const issuerColor = getIssuerColor(card.issuer)
  const isConnected = card.source === "truelayer" || !!liveBal
  const hasAlerts = alerts.length > 0

  // Manual debit/credit entry state
  const [entryAmount, setEntryAmount] = useState("")
  const [entryType, setEntryType] = useState<"debit" | "credit">("debit")

  useEffect(() => {
    if (autoExpand && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: "smooth", block: "center" })
    }
  }, [autoExpand])

  const save = (field: keyof CreditCard, raw: string) => {
    const v = parseFloat(raw)
    if (isNaN(v)) return
    const updates: Partial<CreditCard> = {}
    if (field === "paymentDay") updates.paymentDay = Math.max(1, Math.min(28, Math.round(v)))
    else if (field === "statementDay") updates.statementDay = Math.max(1, Math.min(28, Math.round(v)))
    else (updates as any)[field] = v
    updateCard(card.id, updates)
    toast("Saved")
  }

  // Delete card with summary
  const totalInterest = card.monthlyRecords.reduce((sum, r) => {
    const interest = deriveInterest(card, r)
    return sum + interest
  }, 0)
  const monthCount = card.monthlyRecords.length

  const handleDelete = () => {
    if (!confirmDelete) {
      setConfirmDelete(true)
    } else {
      deleteCard(card.id)
      toast(`${card.issuer} deleted`)
    }
  }

  const addMissingMonth = (month: string) => {
    const opening = getOpeningBalanceForMonth(card, month)
    const interest = estimateInterest(opening, card)
    const closingBalance = computeClosingBalance(opening, 0, 0, interest)
    upsertRecord(card.id, { month, debits: 0, credits: 0, interest, closingBalance, source: "manual" })
    toast(`Record added for ${formatMonthLabel(month)}`)
  }

  const handleRecordUpdate = (month: string, updates: Partial<MonthlyRecord>) => {
    const existing = card.monthlyRecords.find(r => r.month === month)
    if (!existing) return
    const updated = { ...existing, ...updates }
    // Recompute interest and closing balance if debits/credits changed (but not if overriding closing balance)
    if ((updates.debits !== undefined || updates.credits !== undefined) && updates.closingBalance === undefined) {
      const opening = getOpeningBalanceForMonth(card, month)
      const interest = estimateInterest(opening, card)
      updated.interest = interest
      updated.closingBalance = computeClosingBalance(opening, updated.debits, updated.credits, interest)
    }
    upsertRecord(card.id, updated)
    toast("Saved")
  }

  const handleDeleteRecord = (month: string) => {
    deleteRecord(card.id, month)
    toast("Record deleted")
  }

  const handleAddEntry = () => {
    const amount = parseFloat(entryAmount)
    if (isNaN(amount) || amount <= 0) return

    const existing = card.monthlyRecords.find(r => r.month === cm)
    const opening = getOpeningBalanceForMonth(card, cm)

    if (existing) {
      const newDebits = entryType === "debit" ? existing.debits + amount : existing.debits
      const newCredits = entryType === "credit" ? existing.credits + amount : existing.credits
      const interest = estimateInterest(opening, card)
      const closingBalance = computeClosingBalance(opening, newDebits, newCredits, interest)
      upsertRecord(card.id, { ...existing, debits: newDebits, credits: newCredits, interest, closingBalance })
    } else {
      const debits = entryType === "debit" ? amount : 0
      const credits = entryType === "credit" ? amount : 0
      const interest = estimateInterest(opening, card)
      const closingBalance = computeClosingBalance(opening, debits, credits, interest)
      upsertRecord(card.id, { month: cm, debits, credits, interest, closingBalance, source: "manual" })
    }

    toast(`${entryType === "debit" ? "Debit" : "Credit"} of ${fmt(amount, currency)} added`)
    setEntryAmount("")
  }

  const [editingOpeningMonth, setEditingOpeningMonth] = useState(false)
  const [openingMonthInput, setOpeningMonthInput] = useState(card.openingMonth)
  const [promoEditing, setPromoEditing] = useState(false)
  const [promoRate, setPromoRate] = useState(card.aprPromo ?? 0)
  const [promoDate, setPromoDate] = useState(card.promoUntil?.substring(0, 7) || new Date().toISOString().substring(0, 7))

  const sortedRecords = [...card.monthlyRecords].sort((a, b) => b.month.localeCompare(a.month))

  return (
    <div ref={cardRef} className={cn(
      "bg-card border rounded-lg overflow-hidden transition-colors",
      autoExpand ? "border-ring ring-2 ring-ring/20" : issuerColor.border
    )}>
      {/* Collapsed tile */}
      <div className="flex items-center px-4 py-3.5 gap-3 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className={cn("w-2.5 h-2.5 rounded-full shrink-0", utilBarColor(util))} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-semibold truncate">{card.issuer}</span>
            <span className="text-xs text-muted-foreground font-mono">•••• {card.last4}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-sm font-semibold tabular-nums">{fmt(balance, currency)}</span>
          {hasAlerts && <div className="w-2 h-2 rounded-full bg-orange-500 shrink-0" />}
          {isConnected && <Wifi className="w-3 h-3 text-success shrink-0" />}
          <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", expanded && "rotate-180")} />
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-border px-4 pb-4">
          <div className="grid grid-cols-2 gap-3 pt-3.5">
            <div><Label>Balance</Label><div className="text-sm font-medium">{fmt(balance, currency)}</div></div>
            <div><Label>Credit Limit</Label><div className="text-sm font-medium"><InlineEdit value={card.limit} displayValue={fmt(card.limit, currency)} type="number" step="0.01" onSave={v => save("limit", v)} inputClassName="w-24" /></div></div>
            <div><Label>Regular APR</Label><div className="text-sm font-medium"><InlineEdit value={card.aprRegular} displayValue={`${card.aprRegular}%`} type="number" step="0.01" onSave={v => save("aprRegular", v)} inputClassName="w-16" /></div></div>

            {/* Promo APR */}
            <div className="col-span-2">
              <Label>Promotional APR</Label>
              {promoEditing ? (
                <div className="flex items-center gap-1.5 flex-wrap mt-1">
                  <input type="number" step="0.01" min="0" value={promoRate} onChange={e => setPromoRate(parseFloat(e.target.value) || 0)}
                    className="h-7 w-16 px-2 text-sm bg-background border border-ring rounded-md outline-none" />
                  <span className="text-xs">% until</span>
                  <input type="month" value={promoDate} onChange={e => setPromoDate(e.target.value)}
                    className="h-7 px-2 text-sm bg-background border border-ring rounded-md outline-none" />
                  <button onClick={() => { updateCard(card.id, { aprPromo: promoRate, promoUntil: promoDate + "-01" }); setPromoEditing(false); toast("Promo APR saved") }}
                    className="h-7 px-2 text-xs border border-border rounded-md hover:bg-accent">Set</button>
                  {card.aprPromo !== null && (
                    <button onClick={() => { updateCard(card.id, { aprPromo: null, promoUntil: null }); setPromoEditing(false); toast("Promo cleared") }}
                      className="h-7 px-2 text-xs text-destructive border border-destructive/30 rounded-md hover:bg-destructive/10">Clear</button>
                  )}
                  <button onClick={() => setPromoEditing(false)} className="h-7 px-2 text-xs text-muted-foreground border border-border rounded-md">Cancel</button>
                </div>
              ) : (
                <div className="text-sm font-medium cursor-pointer border-b border-dashed border-border hover:border-ring pb-px inline-block"
                  onClick={() => setPromoEditing(true)}>
                  {card.aprPromo !== null ? `${card.aprPromo}% until ${formatDate(card.promoUntil)}` : "None -- click to set"}
                </div>
              )}
            </div>

            <div>
              <Label>Payment Date</Label>
              <div className="text-sm font-medium"><InlineEdit value={card.paymentDay} displayValue={`${ordinal(card.paymentDay)} of each month`} type="number" min="1" max="28" step="1" onSave={v => save("paymentDay", v)} inputClassName="w-12 text-center" /></div>
            </div>
            <div>
              <Label>Statement Closes</Label>
              <div className="text-sm font-medium"><InlineEdit value={card.statementDay} displayValue={`${ordinal(card.statementDay)} of each month`} type="number" min="1" max="28" step="1" onSave={v => save("statementDay", v)} inputClassName="w-12 text-center" /></div>
            </div>

            {/* Direct debit */}
            <div className="col-span-2 border-t border-border pt-3 mt-1">
              <Label className="mb-2">Direct Debit Setup</Label>
              <div className="space-y-2">
                {(["minimum", "custom", "full", "none"] as const).map(opt => (
                  <label key={opt} className="flex items-center gap-2 text-[0.8125rem] cursor-pointer">
                    <input type="radio" name={`dd-${card.id}`} checked={card.dd === opt}
                      onChange={() => { updateCard(card.id, { dd: opt }); toast("Direct debit updated") }}
                      className="w-3.5 h-3.5 accent-foreground" />
                    {opt === "minimum" && "Minimum payment"}
                    {opt === "custom" && (
                      <span className="flex items-center gap-1.5">
                        Custom
                        <input type="number" value={card.ddAmount || ""} placeholder={`${currencySymbol(currency)}0`}
                          onClick={e => e.stopPropagation()}
                          onChange={e => updateCard(card.id, { dd: "custom", ddAmount: parseFloat(e.target.value) || 0 })}
                          onBlur={() => toast("Saved")}
                          className="w-20 h-7 px-2 text-[0.8125rem] bg-transparent border border-border rounded-md outline-none focus:border-ring" />
                      </span>
                    )}
                    {opt === "full" && "Full balance"}
                    {opt === "none" && "No direct debit"}
                  </label>
                ))}
              </div>
            </div>

            {/* Manual entry for manual cards */}
            {card.source === "manual" && !liveBal && (
              <div className="col-span-2 border-t border-border pt-3 mt-1">
                <Label className="mb-2">Add Debit / Credit</Label>
                <div className="flex items-center gap-2">
                  <div className="flex rounded-md border border-border overflow-hidden">
                    <button
                      onClick={() => setEntryType("debit")}
                      className={cn("px-2.5 py-1.5 text-xs font-medium transition-colors",
                        entryType === "debit" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <Minus className="w-3 h-3 inline mr-1" />Debit
                    </button>
                    <button
                      onClick={() => setEntryType("credit")}
                      className={cn("px-2.5 py-1.5 text-xs font-medium transition-colors",
                        entryType === "credit" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <Plus className="w-3 h-3 inline mr-1" />Credit
                    </button>
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={entryAmount}
                    onChange={e => setEntryAmount(e.target.value)}
                    placeholder="0.00"
                    className="flex-1 h-8 px-2.5 text-sm bg-background border border-border rounded-md outline-none focus:border-ring tabular-nums"
                  />
                  <button
                    onClick={handleAddEntry}
                    disabled={!entryAmount || parseFloat(entryAmount) <= 0}
                    className="h-8 px-3 bg-foreground text-background rounded-md text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-40"
                  >
                    Add
                  </button>
                </div>
              </div>
            )}

            {/* Monthly Records History */}
            <div className="col-span-2 border-t border-border pt-3 mt-1">
              <div className="flex items-center justify-between mb-2">
                <Label>Monthly History</Label>
                <div className="flex gap-1.5">
                  {sortedRecords.length > 2 && (
                    <button
                      onClick={() => setShowHistory(!showHistory)}
                      className="text-[0.6875rem] text-muted-foreground hover:text-foreground px-2 py-1 rounded-md transition-colors"
                    >
                      {showHistory ? "Show less" : `Show all (${sortedRecords.length})`}
                    </button>
                  )}
                </div>
              </div>

              {/* Opening balance */}
              <div className="text-[0.6875rem] text-muted-foreground mb-2 flex items-center gap-1.5 flex-wrap">
                <span>Opening balance (</span>
                {editingOpeningMonth ? (
                  <span className="inline-flex items-center gap-1">
                    <input
                      type="month"
                      value={openingMonthInput}
                      onChange={e => setOpeningMonthInput(e.target.value)}
                      autoFocus
                      className="h-6 px-1.5 text-[0.6875rem] bg-background border border-ring rounded-md outline-none"
                    />
                    <button onClick={() => {
                      if (openingMonthInput) { updateCard(card.id, { openingMonth: openingMonthInput }); toast("Opening month updated") }
                      setEditingOpeningMonth(false)
                    }} className="text-[0.625rem] font-medium underline">Save</button>
                    <button onClick={() => { setEditingOpeningMonth(false); setOpeningMonthInput(card.openingMonth) }} className="text-[0.625rem] text-muted-foreground underline">Cancel</button>
                  </span>
                ) : (
                  <span
                    className="cursor-pointer border-b border-dashed border-border hover:border-ring pb-px"
                    onClick={() => { setOpeningMonthInput(card.openingMonth); setEditingOpeningMonth(true) }}
                  >
                    {formatMonthLabel(card.openingMonth)}
                  </span>
                )}
                <span>):</span>
                <InlineEdit
                  value={card.openingBalance}
                  displayValue={fmt(card.openingBalance, currency)}
                  type="number"
                  step="0.01"
                  onSave={v => { const n = parseFloat(v); if (!isNaN(n)) { updateCard(card.id, { openingBalance: n }); toast("Opening balance updated") } }}
                  inputClassName="w-24"
                />
              </div>

              {pastMissing.length > 0 && (
                <div className="bg-warning/10 border border-warning/20 rounded-md px-2.5 py-2 mb-2">
                  <div className="flex items-center gap-1.5 text-[0.6875rem] text-warning font-medium mb-1.5">
                    <AlertTriangle className="w-3 h-3 shrink-0" />
                    {pastMissing.length} missing record{pastMissing.length !== 1 ? "s" : ""}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {pastMissing.map(m => (
                      <button
                        key={m}
                        onClick={() => addMissingMonth(m)}
                        className="text-[0.625rem] font-medium bg-warning/20 text-warning hover:bg-warning/30 px-1.5 py-0.5 rounded transition-colors"
                      >
                        + {formatMonthLabel(m)}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-1">
                {(showHistory ? sortedRecords : sortedRecords.slice(0, 2)).map(record => (
                  <MonthRow
                    key={record.month}
                    record={record}
                    card={card}
                    currency={currency}
                    isCurrentMonth={record.month === cm}
                    onUpdate={updates => handleRecordUpdate(record.month, updates)}
                    onDelete={() => handleDeleteRecord(record.month)}
                  />
                ))}
                {sortedRecords.length === 0 && (
                  <div className="text-xs text-muted-foreground italic py-2">No records yet -- add a debit or credit above to start tracking.</div>
                )}
              </div>
            </div>

            {/* Delete card */}
            <div className="col-span-2 border-t border-border pt-3 mt-1">
              {confirmDelete ? (
                <div className="bg-destructive/5 border border-destructive/20 rounded-md p-3">
                  <p className="text-xs text-destructive font-medium mb-2">
                    This will remove {monthCount} month{monthCount !== 1 ? "s" : ""} of history. Total interest tracked: {fmt(totalInterest, currency)}. Are you sure?
                  </p>
                  <div className="flex items-center gap-2">
                    <button onClick={handleDelete}
                      className="text-xs font-medium text-destructive underline">Confirm delete</button>
                    <button onClick={() => setConfirmDelete(false)}
                      className="text-xs text-muted-foreground underline">Cancel</button>
                  </div>
                </div>
              ) : (
                <button onClick={handleDelete}
                  className="w-full flex items-center justify-center gap-2 py-2 text-xs font-medium rounded-md transition-colors text-muted-foreground hover:text-destructive hover:bg-destructive/5">
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete card
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Label({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("text-[0.6875rem] uppercase tracking-wider text-muted-foreground font-medium", className)}>{children}</div>
}

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "default", label: "Default" },
  { key: "due", label: "Due Date" },
  { key: "balance", label: "Balance" },
  { key: "utilization", label: "Utilization" },
  { key: "apr", label: "APR" },
]

function sortCards(cards: CreditCard[], sort: SortKey, utilThreshold: number, liveBalMap: Map<number, LiveBal>): CreditCard[] {
  const sorted = [...cards]
  const now = new Date()
  const currentDay = now.getDate()

  if (sort === "default") {
    // Smart default: cards needing attention first, then alphabetical
    return sorted.sort((a, b) => {
      const aLive = liveBalMap.get(a.id)
      const bLive = liveBalMap.get(b.id)
      const aAlerts = needsAttention(a, utilThreshold, aLive ? { current: aLive.current, creditLimit: aLive.creditLimit } : undefined)
      const bAlerts = needsAttention(b, utilThreshold, bLive ? { current: bLive.current, creditLimit: bLive.creditLimit } : undefined)
      const aNeeds = aAlerts.length > 0 ? 0 : 1
      const bNeeds = bAlerts.length > 0 ? 0 : 1
      if (aNeeds !== bNeeds) return aNeeds - bNeeds
      return a.issuer.localeCompare(b.issuer)
    })
  }

  switch (sort) {
    case "due":
      return sorted.sort((a, b) => {
        const da = (a.paymentDay - currentDay + 30) % 30
        const db = (b.paymentDay - currentDay + 30) % 30
        return da - db
      })
    case "balance":
      return sorted.sort((a, b) => {
        const balA = liveBalMap.get(a.id)?.current ?? getBalance(a)
        const balB = liveBalMap.get(b.id)?.current ?? getBalance(b)
        return balB - balA
      })
    case "utilization":
      return sorted.sort((a, b) => utilPercent(b) - utilPercent(a))
    case "apr":
      return sorted.sort((a, b) => getEffectiveAPR(b) - getEffectiveAPR(a))
    default:
      return sorted
  }
}

interface TLCardData {
  partialNumber: string
  displayName: string
  balance: { current: number; available: number; creditLimit: number } | null
  accountId?: string
}

const MATCHING_BANNER_KEY = "cardpulse-matching-banner-dismissed"

function MatchingBanner({ cards, tlCards, onLink }: {
  cards: CreditCard[]
  tlCards: TLCardData[]
  onLink: (matches: { cardId: number; tlAccountId: string }[]) => void
}) {
  const [dismissed, setDismissed] = useState(false)
  const [selected, setSelected] = useState<Set<number>>(new Set())

  // Find manual cards whose last4 matches a TrueLayer card
  const matches: { card: CreditCard; tlCard: TLCardData }[] = []
  for (const card of cards) {
    if (card.source !== "manual") continue
    const match = tlCards.find(tc => tc.partialNumber && tc.partialNumber.endsWith(card.last4))
    if (match) matches.push({ card, tlCard: match })
  }

  useEffect(() => {
    if (typeof window !== "undefined" && localStorage.getItem(MATCHING_BANNER_KEY)) {
      setDismissed(true)
    }
  }, [])

  // Pre-select all on first render
  useEffect(() => {
    if (matches.length > 0) {
      setSelected(new Set(matches.map(m => m.card.id)))
    }
  }, [matches.length])

  if (dismissed || matches.length === 0) return null

  const handleDismiss = () => {
    setDismissed(true)
    if (typeof window !== "undefined") localStorage.setItem(MATCHING_BANNER_KEY, "1")
  }

  const handleConfirm = () => {
    const toLink = matches
      .filter(m => selected.has(m.card.id))
      .map(m => ({ cardId: m.card.id, tlAccountId: m.tlCard.accountId || "" }))
    if (toLink.length > 0) onLink(toLink)
    handleDismiss()
  }

  const toggleCard = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="bg-primary/5 border border-primary/20 rounded-lg px-4 py-3 mb-3">
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-sm font-medium">
          We found {matches.length} card{matches.length !== 1 ? "s" : ""} in your bank that match your manual cards -- link them?
        </p>
        <button onClick={handleDismiss} className="text-muted-foreground hover:text-foreground shrink-0">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="space-y-1.5 mb-3">
        {matches.map(m => (
          <label key={m.card.id} className="flex items-center gap-2 text-[0.8125rem] cursor-pointer">
            <input
              type="checkbox"
              checked={selected.has(m.card.id)}
              onChange={() => toggleCard(m.card.id)}
              className="w-3.5 h-3.5 accent-foreground"
            />
            {m.card.issuer} •••• {m.card.last4}
          </label>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={handleConfirm}
          disabled={selected.size === 0}
          className="h-7 px-3 bg-foreground text-background rounded-md text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-40"
        >
          Link selected
        </button>
        <button onClick={handleDismiss} className="text-xs text-muted-foreground underline">Dismiss</button>
      </div>
    </div>
  )
}

function CardsContent() {
  const { cards, utilThreshold, updateCard } = useStore()
  const { toast } = useToast()
  const searchParams = useSearchParams()
  const highlightId = searchParams.get("highlight") ? parseInt(searchParams.get("highlight")!) : null
  const [sort, setSort] = useState<SortKey>("default")
  const [tlCards, setTlCards] = useState<TLCardData[]>([])
  const [bankConnected, setBankConnected] = useState(false)

  useEffect(() => {
    fetch("/api/truelayer/balances")
      .then(r => r.json())
      .then(d => {
        if (d.connected) {
          setBankConnected(true)
          if (d.cards) setTlCards(d.cards)
        }
      })
      .catch(() => {})
  }, [])

  const liveBalMap = new Map<number, LiveBal>()
  for (const card of cards) {
    const match = tlCards.find(tc => tc.partialNumber && tc.partialNumber.endsWith(card.last4))
    if (match?.balance) liveBalMap.set(card.id, match.balance)
  }

  // Pre-compute alerts for each card
  const alertsMap = new Map<number, string[]>()
  for (const card of cards) {
    const live = liveBalMap.get(card.id)
    alertsMap.set(card.id, needsAttention(card, utilThreshold, live ? { current: live.current, creditLimit: live.creditLimit } : undefined))
  }

  const sorted = sortCards(cards, sort, utilThreshold, liveBalMap)

  const handleLinkCards = (matches: { cardId: number; tlAccountId: string }[]) => {
    for (const m of matches) {
      updateCard(m.cardId, { source: "truelayer", tlAccountId: m.tlAccountId })
    }
    toast(`${matches.length} card${matches.length !== 1 ? "s" : ""} linked`)
  }

  return (
    <>
      {/* Matching banner */}
      {bankConnected && (
        <MatchingBanner cards={cards} tlCards={tlCards} onLink={handleLinkCards} />
      )}

      <div className="flex items-center justify-between pb-3">
        <p className="text-[0.8125rem] text-muted-foreground">{cards.length} card{cards.length !== 1 ? "s" : ""} linked</p>
        <div className="flex items-center gap-1">
          <ArrowUpDown className="w-3 h-3 text-muted-foreground" />
          <select
            value={sort}
            onChange={e => setSort(e.target.value as SortKey)}
            className="text-xs bg-transparent text-muted-foreground outline-none cursor-pointer"
          >
            {SORT_OPTIONS.map(o => (
              <option key={o.key} value={o.key}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="space-y-2">
        {sorted.map(card => (
          <CardItem
            key={card.id}
            card={card}
            autoExpand={card.id === highlightId}
            liveBal={liveBalMap.get(card.id)}
            alerts={alertsMap.get(card.id) || []}
          />
        ))}
      </div>
    </>
  )
}

export default function CardsPage() {
  return (
    <Suspense>
      <CardsContent />
    </Suspense>
  )
}
