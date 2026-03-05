"use client"

import { useState } from "react"
import { ChevronDown, Eye, Search, Trash2 } from "lucide-react"
import { useStore } from "@/lib/store"
import { useToast } from "@/components/toast"
import { InlineEdit } from "@/components/ui/inline-edit"
import { fmt, utilPercent, utilColor, utilBarColor, calcInterest, getEffectiveAPR, ordinal, maskNumber, formatDate, cn, currencySymbol } from "@/lib/utils"
import { CreditCard } from "@/types/card"

function CardItem({ card }: { card: CreditCard }) {
  const { updateCard, deleteCard, currency } = useStore()
  const { toast } = useToast()
  const [expanded, setExpanded] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<0 | 1 | 2>(0) // 0=none, 1=first, 2=second

  const util = utilPercent(card)
  const avail = card.limit - card.balance
  const interest = calcInterest(card)

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

  const [promoEditing, setPromoEditing] = useState(false)
  const [promoRate, setPromoRate] = useState(card.aprPromo ?? 0)
  const [promoDate, setPromoDate] = useState(card.promoUntil?.substring(0, 7) || new Date().toISOString().substring(0, 7))

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden hover:border-ring/40 transition-colors">
      {/* Summary row */}
      <div className="flex items-center px-4 py-3.5 gap-3">
        <div className="min-w-0 flex-1 cursor-pointer" onClick={() => setExpanded(!expanded)}>
          <div className="text-sm font-semibold truncate">{card.issuer}</div>
          <div className="text-xs text-muted-foreground font-mono">•••• {card.last4}</div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-sm font-semibold tabular-nums">
            <InlineEdit value={card.balance} displayValue={fmt(card.balance, currency)} type="number" step="0.01"
              onSave={v => save("balance", v)} inputClassName="w-24" />
          </div>
          <div className="text-[0.6875rem] text-muted-foreground">{fmt(avail, currency)} avail</div>
        </div>
        <div className="flex gap-1 shrink-0">
          <button onClick={() => {}} className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:bg-accent hover:text-foreground rounded-md transition-colors">
            <Search className="w-4 h-4" />
          </button>
          <button onClick={e => { e.stopPropagation(); handleDelete() }}
            className={cn("w-8 h-8 flex items-center justify-center rounded-md transition-colors",
              confirmDelete > 0 ? "text-destructive bg-destructive/10" : "text-muted-foreground hover:bg-accent hover:text-destructive")}>
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
        <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform cursor-pointer shrink-0", expanded && "rotate-180")}
          onClick={() => setExpanded(!expanded)} />
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
          <div className="grid grid-cols-2 gap-3 pt-3.5">
            {/* Card number */}
            <div className="col-span-2">
              <Label>Card Number</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium font-mono tracking-wider">{revealed ? card.fullNumber : maskNumber(card.fullNumber)}</span>
                <button onClick={() => setRevealed(!revealed)} className="w-7 h-7 flex items-center justify-center text-muted-foreground hover:bg-accent rounded-md">
                  <Eye className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div><Label>Balance</Label><div className="text-sm font-medium"><InlineEdit value={card.balance} displayValue={fmt(card.balance, currency)} type="number" step="0.01" onSave={v => save("balance", v)} inputClassName="w-24" /></div></div>
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

            <div className="col-span-2">
              <Label>Address on File</Label>
              <div className="text-sm font-medium"><InlineEdit value={card.address} displayValue={card.address} onSave={v => { updateCard(card.id, { address: v }); toast("Saved") }} inputClassName="w-full" /></div>
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
          </div>
        </div>
      )}
    </div>
  )
}

function Label({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("text-[0.6875rem] uppercase tracking-wider text-muted-foreground font-medium", className)}>{children}</div>
}

export default function CardsPage() {
  const { cards } = useStore()
  return (
    <>
      <div className="pb-4">
        <h2 className="text-xl font-semibold tracking-tight">My Cards</h2>
        <p className="text-[0.8125rem] text-muted-foreground mt-0.5">{cards.length} card{cards.length !== 1 ? "s" : ""} linked</p>
      </div>
      <div className="space-y-2">
        {cards.map(card => <CardItem key={card.id} card={card} />)}
      </div>
    </>
  )
}
