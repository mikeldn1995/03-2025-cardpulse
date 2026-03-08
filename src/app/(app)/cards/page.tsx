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
  deriveInterest,
} from "@/lib/utils"
import { CreditCard, MonthlyRecord } from "@/types/card"

function formatMonthLabel(m: string): string {
  const [y, mo] = m.split("-")
  const d = new Date(parseInt(y), parseInt(mo) - 1)
  return d.toLocaleDateString("en-GB", { month: "short", year: "numeric" })
}

function RecordRow({ record, card, currency, isCurrentMonth, onUpdate, onDelete }: {
  record: MonthlyRecord
  card: CreditCard
  currency: string
  isCurrentMonth?: boolean
  onUpdate: (updates: Partial<MonthlyRecord>) => void
  onDelete: () => void
}) {
  const [confirmDel, setConfirmDel] = useState(false)
  const opening = getOpeningBalanceForMonth(card, record.month)
  const derivedInterest = deriveInterest(card, record)

  return (
    <div className={cn("rounded-md px-3 py-2", isCurrentMonth ? "bg-primary/5 border border-primary/20" : "bg-secondary/50")}>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-semibold flex items-center gap-1.5">
          {formatMonthLabel(record.month)}
          {isCurrentMonth && <span className="text-[0.625rem] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium">Current</span>}
          <span className={cn(
            "text-[0.625rem] uppercase tracking-wider font-medium px-1.5 py-0.5 rounded",
            record.source === "truelayer" ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"
          )}>
            {record.source === "truelayer" ? "Live" : "Manual"}
          </span>
        </span>
        <div className="flex items-center gap-1">
          {confirmDel ? (
            <div className="flex items-center gap-1">
              <button onClick={onDelete} className="text-[0.625rem] text-destructive font-medium underline">Delete</button>
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
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
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
          <div className="text-muted-foreground mb-0.5">Interest <span className="italic opacity-60">(derived)</span></div>
          <span className="text-sm font-medium">{fmt(derivedInterest, currency)}</span>
        </div>
        <div>
          <div className="text-muted-foreground mb-0.5">Closing Balance</div>
          <InlineEdit
            value={record.closingBalance}
            displayValue={fmt(record.closingBalance, currency)}
            type="number"
            step="0.01"
            onSave={v => { const n = parseFloat(v); if (!isNaN(n)) onUpdate({ closingBalance: n }) }}
            inputClassName="w-24"
          />
        </div>
      </div>
    </div>
  )
}

type SortKey = "default" | "due" | "balance" | "utilization" | "apr"

interface LiveBal { current: number; available: number; creditLimit: number }

function CardItem({ card, autoExpand, liveBal }: { card: CreditCard; autoExpand?: boolean; liveBal?: LiveBal | null }) {
  const { updateCard, deleteCard, upsertRecord, deleteRecord, currency } = useStore()
  const { toast } = useToast()
  const [expanded, setExpanded] = useState(autoExpand || false)
  const [confirmDelete, setConfirmDelete] = useState<0 | 1 | 2>(0)
  const [showHistory, setShowHistory] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)

  const balance = liveBal ? liveBal.current : getBalance(card)
  const limit = liveBal ? liveBal.creditLimit : card.limit
  const util = limit > 0 ? (balance / limit) * 100 : 0
  const avail = limit - balance
  const cm = currentMonth()
  const allMissing = getMissingMonths(card)
  const pastMissing = allMissing.filter(m => m !== cm)
  const effectiveAPR = getEffectiveAPR(card)
  const issuerColor = getIssuerColor(card.issuer)
  const isConnected = card.source === "truelayer" || !!liveBal

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

  const handleDelete = () => {
    if (confirmDelete === 0) setConfirmDelete(1)
    else if (confirmDelete === 1) setConfirmDelete(2)
    else { deleteCard(card.id); toast(`${card.issuer} deleted`) }
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
    // Recompute interest and closing balance if debits/credits changed
    if (updates.debits !== undefined || updates.credits !== undefined) {
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
      {/* Summary row */}
      <div className="flex items-center px-4 py-3.5 gap-3 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className={cn("w-2.5 h-2.5 rounded-full shrink-0", utilBarColor(util))} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-semibold truncate">{card.issuer}</span>
            {isConnected && <Wifi className="w-2.5 h-2.5 text-success shrink-0" />}
            {pastMissing.length > 0 && <AlertTriangle className="w-3.5 h-3.5 text-warning shrink-0" />}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground font-mono">•••• {card.last4}</span>
            <span className={cn(
              "text-[0.625rem] font-medium px-1 py-px rounded",
              card.aprPromo !== null && card.promoUntil && new Date(card.promoUntil) > new Date()
                ? "bg-success/15 text-success"
                : "bg-muted text-muted-foreground"
            )}>
              {effectiveAPR}%{card.aprPromo !== null && card.promoUntil && new Date(card.promoUntil) > new Date() ? " promo" : " APR"}
            </span>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-sm font-semibold tabular-nums">{fmt(balance, currency)}</div>
          <div className="text-[0.6875rem] text-muted-foreground">{fmt(avail, currency)} avail</div>
        </div>
        <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform shrink-0", expanded && "rotate-180")} />
      </div>

      {/* Delete confirmation */}
      {confirmDelete > 0 && (
        <div className="px-4 pb-3 flex items-center gap-2">
          <span className="text-xs text-destructive font-medium">
            {confirmDelete === 1 ? "Delete this card?" : "Are you sure? This cannot be undone."}
          </span>
          <button onClick={handleDelete} className="text-xs font-medium text-destructive underline">
            {confirmDelete === 1 ? "Yes, delete" : "Confirm delete"}
          </button>
          <button onClick={() => setConfirmDelete(0)} className="text-xs text-muted-foreground underline">Cancel</button>
        </div>
      )}

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-border px-4 pb-4">
          {/* Card Settings */}
          <div className="grid grid-cols-2 gap-3 pt-3.5">
            <div><Label>Balance <span className="italic opacity-60">(auto)</span></Label><div className="text-sm font-medium">{fmt(balance, currency)}</div></div>
            <div><Label>Available <span className="italic opacity-60">(auto)</span></Label><div className="text-sm font-medium opacity-65 italic">{fmt(avail, currency)}</div></div>
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
                  {card.aprPromo !== null ? `${card.aprPromo}% until ${formatDate(card.promoUntil)}` : "None — click to set"}
                </div>
              )}
            </div>

            <div>
              <Label>Utilization</Label>
              <div className="mt-1">
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className={cn("h-full rounded-full transition-all", utilBarColor(util))} style={{ width: `${Math.min(util, 100)}%` }} />
                </div>
                <div className={cn("text-xs font-semibold mt-1", utilColor(util))}>{util.toFixed(1)}%</div>
              </div>
            </div>
            <div><Label>Effective APR</Label><div className="text-sm font-medium">{effectiveAPR}%</div></div>

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

              <div className="space-y-1.5">
                {(showHistory ? sortedRecords : sortedRecords.slice(0, 2)).map(record => (
                  <RecordRow
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
                  <div className="text-xs text-muted-foreground italic py-2">No records yet — add a debit or credit above to start tracking.</div>
                )}
              </div>
            </div>

            {/* Delete card */}
            <div className="col-span-2 border-t border-border pt-3 mt-1">
              <button onClick={handleDelete}
                className={cn("w-full flex items-center justify-center gap-2 py-2 text-xs font-medium rounded-md transition-colors",
                  confirmDelete > 0 ? "bg-destructive/10 text-destructive border border-destructive/30" : "text-muted-foreground hover:text-destructive hover:bg-destructive/5"
                )}>
                <Trash2 className="w-3.5 h-3.5" />
                {confirmDelete === 0 ? "Delete card" : confirmDelete === 1 ? "Tap again to confirm" : "Final confirmation — delete forever"}
              </button>
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

function sortCards(cards: CreditCard[], sort: SortKey): CreditCard[] {
  const sorted = [...cards]
  const now = new Date()
  const currentDay = now.getDate()
  switch (sort) {
    case "due":
      return sorted.sort((a, b) => {
        const da = (a.paymentDay - currentDay + 30) % 30
        const db = (b.paymentDay - currentDay + 30) % 30
        return da - db
      })
    case "balance":
      return sorted.sort((a, b) => getBalance(b) - getBalance(a))
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
}

function CardsContent() {
  const { cards } = useStore()
  const searchParams = useSearchParams()
  const highlightId = searchParams.get("highlight") ? parseInt(searchParams.get("highlight")!) : null
  const [sort, setSort] = useState<SortKey>("default")
  const [tlCards, setTlCards] = useState<TLCardData[]>([])

  useEffect(() => {
    fetch("/api/truelayer/balances")
      .then(r => r.json())
      .then(d => { if (d.connected && d.cards) setTlCards(d.cards) })
      .catch(() => {})
  }, [])

  const liveBalMap = new Map<number, LiveBal>()
  for (const card of cards) {
    const match = tlCards.find(tc => tc.partialNumber && tc.partialNumber.endsWith(card.last4))
    if (match?.balance) liveBalMap.set(card.id, match.balance)
  }

  const sorted = sortCards(cards, sort)

  return (
    <>
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
        {sorted.map(card => <CardItem key={card.id} card={card} autoExpand={card.id === highlightId} liveBal={liveBalMap.get(card.id)} />)}
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
