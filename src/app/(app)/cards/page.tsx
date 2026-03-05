"use client"

import { useState, useEffect, useRef, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { ChevronDown, Eye, Trash2, AlertTriangle, X, RefreshCw, ArrowUpDown } from "lucide-react"
import { useStore } from "@/lib/store"
import { useToast } from "@/components/toast"
import { InlineEdit } from "@/components/ui/inline-edit"
import { fmt, utilPercent, utilColor, utilBarColor, getEffectiveAPR, getBalance, ordinal, maskNumber, formatDate, cn, currencySymbol, getMissingMonths, currentMonth } from "@/lib/utils"
import { CreditCard, StatementEntry } from "@/types/card"

function formatMonthLabel(m: string): string {
  const [y, mo] = m.split("-")
  const d = new Date(parseInt(y), parseInt(mo) - 1)
  return d.toLocaleDateString("en-GB", { month: "short", year: "numeric" })
}

function StatementRow({ entry, card, currency, isCurrentMonth, onUpdate, onDelete, onRecalc }: {
  entry: StatementEntry
  card: CreditCard
  currency: string
  isCurrentMonth?: boolean
  onUpdate: (updates: Partial<StatementEntry>) => void
  onDelete: () => void
  onRecalc: () => void
}) {
  const [confirmDel, setConfirmDel] = useState(false)

  return (
    <div className={cn("rounded-md px-3 py-2", isCurrentMonth ? "bg-primary/5 border border-primary/20" : "bg-secondary/50")}>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-semibold flex items-center gap-1.5">
          {formatMonthLabel(entry.month)}
          {isCurrentMonth && <span className="text-[0.625rem] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium">Live</span>}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={onRecalc}
            title="Recalculate interest"
            className="w-5 h-5 flex items-center justify-center text-muted-foreground hover:text-foreground rounded transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
          </button>
          {confirmDel ? (
            <div className="flex items-center gap-1">
              <button onClick={onDelete} className="text-[0.625rem] text-destructive font-medium underline">Delete</button>
              <button onClick={() => setConfirmDel(false)} className="text-[0.625rem] text-muted-foreground underline">Cancel</button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDel(true)}
              className="w-5 h-5 flex items-center justify-center text-muted-foreground hover:text-destructive rounded transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          )}
          <span className={cn(
            "text-[0.625rem] uppercase tracking-wider font-medium px-1.5 py-0.5 rounded ml-0.5",
            entry.source === "upload" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
          )}>
            {entry.source}
          </span>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div>
          <div className="text-muted-foreground mb-0.5">Spent</div>
          <InlineEdit
            value={entry.spent}
            displayValue={fmt(entry.spent, currency)}
            type="number"
            step="0.01"
            onSave={v => { const n = parseFloat(v); if (!isNaN(n)) onUpdate({ spent: n }) }}
            inputClassName="w-20"
          />
        </div>
        <div>
          <div className="text-muted-foreground mb-0.5">Paid</div>
          <InlineEdit
            value={entry.paid}
            displayValue={fmt(entry.paid, currency)}
            type="number"
            step="0.01"
            onSave={v => { const n = parseFloat(v); if (!isNaN(n)) onUpdate({ paid: n }) }}
            inputClassName="w-20"
          />
        </div>
        <div>
          <div className="text-muted-foreground mb-0.5">Interest</div>
          <InlineEdit
            value={entry.interest}
            displayValue={fmt(entry.interest, currency)}
            type="number"
            step="0.01"
            onSave={v => { const n = parseFloat(v); if (!isNaN(n)) onUpdate({ interest: n }) }}
            inputClassName="w-20"
          />
        </div>
      </div>
    </div>
  )
}

type SortKey = "default" | "due" | "balance" | "utilization" | "apr"

function CardItem({ card, autoExpand }: { card: CreditCard; autoExpand?: boolean }) {
  const { updateCard, deleteCard, upsertStatement, deleteStatement, currency, addresses } = useStore()
  const { toast } = useToast()
  const [expanded, setExpanded] = useState(autoExpand || false)
  const [revealed, setRevealed] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<0 | 1 | 2>(0)
  const [showHistory, setShowHistory] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)

  const balance = getBalance(card)
  const util = utilPercent(card)
  const avail = card.limit - balance
  const lastStatement = card.statements.length > 0 ? card.statements[card.statements.length - 1] : null
  const interest = lastStatement ? lastStatement.interest : 0
  const cm = currentMonth()
  const allMissing = getMissingMonths(card)
  const pastMissing = allMissing.filter(m => m !== cm)
  const currentMonthMissing = allMissing.includes(cm)
  const missingMonths = pastMissing
  const missing = pastMissing.length > 0
  const effectiveAPR = getEffectiveAPR(card)

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
    else (updates as any)[field] = v
    updateCard(card.id, updates)
    toast("Saved")
  }

  const handleDelete = () => {
    if (confirmDelete === 0) setConfirmDelete(1)
    else if (confirmDelete === 1) setConfirmDelete(2)
    else {
      deleteCard(card.id)
      toast(`${card.issuer} deleted`)
    }
  }

  const addMissingMonth = (month: string) => {
    // Calculate balance at that point to estimate interest
    const sorted = [...card.statements].sort((a, b) => a.month.localeCompare(b.month))
    let balAtMonth = card.openingBalance
    for (const s of sorted) {
      if (s.month >= month) break
      balAtMonth += s.spent - s.paid + s.interest
    }
    const isPromo = card.aprPromo !== null && card.promoUntil && new Date(card.promoUntil) > new Date(month + "-28")
    const apr = isPromo ? card.aprPromo! : card.aprRegular
    const monthlyInterest = Math.round(balAtMonth * (apr / 100 / 12) * 100) / 100
    upsertStatement(card.id, { month, spent: 0, paid: 0, interest: monthlyInterest, source: "manual" })
    toast(`Statement added for ${formatMonthLabel(month)}`)
  }

  const handleStatementUpdate = (month: string, updates: Partial<StatementEntry>) => {
    const existing = card.statements.find(s => s.month === month)
    if (!existing) return
    upsertStatement(card.id, { ...existing, ...updates })
    toast("Saved")
  }

  const recalcInterest = (month: string) => {
    // Find the balance just before this statement month
    const sorted = [...card.statements].sort((a, b) => a.month.localeCompare(b.month))
    const idx = sorted.findIndex(s => s.month === month)
    let balBefore = card.openingBalance
    for (let i = 0; i < idx; i++) {
      balBefore += sorted[i].spent - sorted[i].paid + sorted[i].interest
    }
    // Check if promo was active during this month
    const isPromo = card.aprPromo !== null && card.promoUntil && new Date(card.promoUntil) > new Date(month + "-28")
    const apr = isPromo ? card.aprPromo! : card.aprRegular
    const newInterest = Math.round(balBefore * (apr / 100 / 12) * 100) / 100
    const existing = sorted[idx]
    upsertStatement(card.id, { ...existing, interest: newInterest })
    toast(`Interest recalculated: ${fmt(newInterest, currency)}`)
  }

  const handleDeleteStatement = (month: string) => {
    deleteStatement(card.id, month)
    toast("Statement deleted")
  }

  const [editingNumber, setEditingNumber] = useState(false)
  const [numberInput, setNumberInput] = useState(card.fullNumber)
  const [editingOpeningMonth, setEditingOpeningMonth] = useState(false)
  const [openingMonthInput, setOpeningMonthInput] = useState(card.openingMonth)
  const [promoEditing, setPromoEditing] = useState(false)
  const [promoRate, setPromoRate] = useState(card.aprPromo ?? 0)
  const [promoDate, setPromoDate] = useState(card.promoUntil?.substring(0, 7) || new Date().toISOString().substring(0, 7))

  const sortedStatements = [...card.statements].sort((a, b) => b.month.localeCompare(a.month))

  return (
    <div ref={cardRef} className={cn(
      "bg-card border rounded-lg overflow-hidden transition-colors",
      autoExpand ? "border-ring ring-2 ring-ring/20" : missing ? "border-warning/50" : "border-border hover:border-ring/40"
    )}>
      {/* Summary row */}
      <div className="flex items-center px-4 py-3.5 gap-3">
        <div className="min-w-0 flex-1 cursor-pointer" onClick={() => setExpanded(!expanded)}>
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-semibold truncate">{card.issuer}</span>
            {missing && <AlertTriangle className="w-3.5 h-3.5 text-warning shrink-0" />}
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
        <div className="flex gap-1 shrink-0">
          <button onClick={e => { e.stopPropagation(); handleDelete() }}
            className={cn("w-8 h-8 flex items-center justify-center rounded-md transition-colors",
              confirmDelete > 0 ? "text-destructive bg-destructive/10" : "text-muted-foreground hover:bg-accent hover:text-destructive")}>
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
        <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform cursor-pointer shrink-0", expanded && "rotate-180")}
          onClick={() => setExpanded(!expanded)} />
      </div>

      {/* Missing statement banner */}
      {missing && !expanded && (
        <div className="px-4 pb-2">
          <div className="text-[0.6875rem] text-warning flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            {missingMonths.length} missing statement{missingMonths.length !== 1 ? "s" : ""} since {formatMonthLabel(card.openingMonth)}
          </div>
        </div>
      )}

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
          <div className="grid grid-cols-2 gap-3 pt-3.5">
            {/* Card number */}
            <div className="col-span-2">
              <Label>Card Number</Label>
              {editingNumber ? (
                <form className="flex items-center gap-1.5 mt-0.5" onSubmit={e => {
                  e.preventDefault()
                  updateCard(card.id, { fullNumber: numberInput.trim() })
                  setEditingNumber(false)
                  toast("Card number updated")
                }}>
                  <input
                    type="text"
                    value={numberInput}
                    onChange={e => setNumberInput(e.target.value)}
                    placeholder="1234 5678 9012 3456"
                    autoFocus
                    className="h-8 flex-1 px-2 text-sm font-mono bg-background border border-ring rounded-md outline-none"
                  />
                  <button type="submit" className="text-xs font-medium text-foreground underline shrink-0">Save</button>
                  <button type="button" onClick={() => { setEditingNumber(false); setNumberInput(card.fullNumber) }} className="text-xs text-muted-foreground underline shrink-0">Cancel</button>
                </form>
              ) : (
                <div className="flex items-center gap-2">
                  {card.fullNumber ? (
                    <>
                      <span
                        className="text-sm font-medium font-mono tracking-wider cursor-pointer border-b border-dashed border-transparent hover:border-border pb-px"
                        onClick={() => { setNumberInput(card.fullNumber); setEditingNumber(true) }}
                      >
                        {revealed ? card.fullNumber : maskNumber(card.fullNumber)}
                      </span>
                      <button onClick={() => setRevealed(!revealed)} className="w-7 h-7 flex items-center justify-center text-muted-foreground hover:bg-accent rounded-md">
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => { setNumberInput(""); setEditingNumber(true) }}
                      className="text-sm text-muted-foreground cursor-pointer border-b border-dashed border-border hover:border-ring pb-px"
                    >
                      Click to add card number
                    </button>
                  )}
                </div>
              )}
            </div>

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
            <div><Label>Last Month Interest <span className="italic opacity-60">(auto)</span></Label><div className="text-sm font-medium opacity-65 italic">{fmt(interest, currency)}</div></div>

            {/* Address dropdown */}
            <div className="col-span-2">
              <Label>Address on File</Label>
              <select
                value={card.address}
                onChange={e => { updateCard(card.id, { address: e.target.value }); toast("Address updated") }}
                className="w-full h-8 px-2 text-sm bg-background border border-border rounded-md outline-none focus:border-ring mt-0.5"
              >
                {addresses.map(a => <option key={a} value={a}>{a}</option>)}
                {!addresses.includes(card.address) && <option value={card.address}>{card.address}</option>}
              </select>
            </div>
            <div>
              <Label>Payment Date</Label>
              <div className="text-sm font-medium"><InlineEdit value={card.paymentDay} displayValue={`${ordinal(card.paymentDay)} of each month`} type="number" min="1" max="28" step="1" onSave={v => save("paymentDay", v)} inputClassName="w-12 text-center" /></div>
            </div>

            {/* Direct debit */}
            <div className="col-span-2 border-t border-border pt-3 mt-1">
              <Label className="mb-2">Direct Debit Setup</Label>
              <div className="space-y-2">
                {(["minimum", "custom", "none"] as const).map(opt => (
                  <label key={opt} className="flex items-center gap-2 text-[0.8125rem] cursor-pointer">
                    <input type="radio" name={`dd-${card.id}`} checked={card.dd === opt}
                      onChange={() => { updateCard(card.id, { dd: opt }); toast("Direct debit updated") }}
                      className="w-3.5 h-3.5 accent-foreground" />
                    {opt === "minimum" && "Yes — Minimum payment"}
                    {opt === "custom" && (
                      <span className="flex items-center gap-1.5">
                        Yes — Custom
                        <input type="number" value={card.ddAmount || ""} placeholder={`${currencySymbol(currency)}0`}
                          onClick={e => e.stopPropagation()}
                          onChange={e => updateCard(card.id, { dd: "custom", ddAmount: parseFloat(e.target.value) || 0 })}
                          onBlur={() => toast("Saved")}
                          className="w-20 h-7 px-2 text-[0.8125rem] bg-transparent border border-border rounded-md outline-none focus:border-ring" />
                      </span>
                    )}
                    {opt === "none" && "No"}
                  </label>
                ))}
              </div>
            </div>

            {/* Statement History */}
            <div className="col-span-2 border-t border-border pt-3 mt-1">
              <div className="flex items-center justify-between mb-2">
                <Label>Statement History</Label>
                <div className="flex gap-1.5">
                  {sortedStatements.length > 2 && (
                    <button
                      onClick={() => setShowHistory(!showHistory)}
                      className="text-[0.6875rem] text-muted-foreground hover:text-foreground px-2 py-1 rounded-md transition-colors"
                    >
                      {showHistory ? "Show less" : `Show all (${sortedStatements.length})`}
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

              {missing && (
                <div className="bg-warning/10 border border-warning/20 rounded-md px-2.5 py-2 mb-2">
                  <div className="flex items-center gap-1.5 text-[0.6875rem] text-warning font-medium mb-1.5">
                    <AlertTriangle className="w-3 h-3 shrink-0" />
                    {missingMonths.length} missing statement{missingMonths.length !== 1 ? "s" : ""}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {missingMonths.map(m => (
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

              {currentMonthMissing && (
                <button
                  onClick={() => addMissingMonth(cm)}
                  className="w-full text-left bg-primary/5 border border-primary/20 rounded-md px-2.5 py-2 mb-2 hover:bg-primary/10 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="text-[0.6875rem] font-medium text-primary">
                      + Add {formatMonthLabel(cm)} — track live spending
                    </div>
                    <span className="text-[0.625rem] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium">Current</span>
                  </div>
                </button>
              )}

              <div className="space-y-1.5">
                {(showHistory ? sortedStatements : sortedStatements.slice(0, 2)).map(entry => (
                  <StatementRow
                    key={entry.month}
                    entry={entry}
                    card={card}
                    currency={currency}
                    isCurrentMonth={entry.month === cm}
                    onUpdate={updates => handleStatementUpdate(entry.month, updates)}
                    onDelete={() => handleDeleteStatement(entry.month)}
                    onRecalc={() => recalcInterest(entry.month)}
                  />
                ))}
                {sortedStatements.length === 0 && (
                  <div className="text-xs text-muted-foreground italic py-2">No statements yet — click a missing month above or upload a PDF.</div>
                )}
              </div>
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

function CardsContent() {
  const { cards } = useStore()
  const searchParams = useSearchParams()
  const highlightId = searchParams.get("highlight") ? parseInt(searchParams.get("highlight")!) : null
  const [sort, setSort] = useState<SortKey>("default")

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
        {sorted.map(card => <CardItem key={card.id} card={card} autoExpand={card.id === highlightId} />)}
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
