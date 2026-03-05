"use client"

import { useStore } from "@/lib/store"
import { fmt, utilPercent, utilColor, getEffectiveAPR, calcInterest, getGreeting } from "@/lib/utils"

function StatCard({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={`bg-card border border-border rounded-lg p-4 ${full ? "col-span-2" : ""}`}>
      <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</div>
      {children}
    </div>
  )
}

export default function DashboardPage() {
  const { cards, currency, utilThreshold } = useStore()

  const totalBal = cards.reduce((s, c) => s + c.balance, 0)
  const totalLimit = cards.reduce((s, c) => s + c.limit, 0)
  const totalAvail = totalLimit - totalBal
  const totalUtil = totalLimit > 0 ? (totalBal / totalLimit) * 100 : 0
  const totalInterest = cards.reduce((s, c) => s + calcInterest(c), 0)

  let highUtil = 0, highCard = ""
  cards.forEach(c => {
    const u = utilPercent(c)
    if (u > highUtil) { highUtil = u; highCard = `${c.issuer} ••${c.last4}` }
  })

  // Top Tip logic
  const eligible = cards.filter(c => utilPercent(c) < utilThreshold).sort((a, b) => getEffectiveAPR(a) - getEffectiveAPR(b))
  const best = eligible[0] || [...cards].sort((a, b) => (utilPercent(a) + getEffectiveAPR(a)) - (utilPercent(b) + getEffectiveAPR(b)))[0]
  const worst = [...cards].sort((a, b) => (utilPercent(b) + getEffectiveAPR(b)) - (utilPercent(a) + getEffectiveAPR(a)))[0]
  const above = cards.filter(c => utilPercent(c) >= utilThreshold).sort((a, b) => utilPercent(b) - utilPercent(a))

  return (
    <>
      <div className="pb-4">
        <h2 className="text-xl font-semibold tracking-tight">Dashboard</h2>
        <p className="text-[0.8125rem] text-muted-foreground mt-0.5">{getGreeting("Dmitry")}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <StatCard label="Total Utilization">
          <div className={`text-2xl font-bold tracking-tight mt-1 ${utilColor(totalUtil)}`}>{totalUtil.toFixed(1)}%</div>
        </StatCard>
        <StatCard label="Highest Utilization">
          <div className={`text-2xl font-bold tracking-tight mt-1 ${utilColor(highUtil)}`}>{highUtil.toFixed(1)}%</div>
          <div className="text-xs text-muted-foreground mt-0.5">{highCard}</div>
        </StatCard>
        <StatCard label="Last Month Interest">
          <div className="text-2xl font-bold tracking-tight mt-1">{fmt(totalInterest, currency)}</div>
        </StatCard>
        <StatCard label="Total Balance">
          <div className="text-2xl font-bold tracking-tight mt-1">{fmt(totalBal, currency)}</div>
        </StatCard>
        <StatCard label="Total Available Credit" full>
          <div className="text-2xl font-bold tracking-tight mt-1">{fmt(totalAvail, currency)}</div>
        </StatCard>
      </div>

      {best && worst && (
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 text-[0.8125rem] font-semibold mb-3">
            <svg className="w-[18px] h-[18px] text-warning" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
            Top Tip
          </div>
          <div className="space-y-3">
            <div>
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">Use First</div>
              <div className="text-[0.8125rem] text-success">
                {best.issuer} ••{best.last4} — {utilPercent(best).toFixed(1)}% util, {getEffectiveAPR(best)}% APR{best.aprPromo !== null ? " (promo)" : ""}
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">Avoid Using</div>
              <div className="text-[0.8125rem] text-destructive">
                {worst.issuer} ••{worst.last4} — {utilPercent(worst).toFixed(1)}% util, {getEffectiveAPR(worst)}% APR
              </div>
            </div>
            {above.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">Above {utilThreshold}% Utilization</div>
                <div className="text-[0.8125rem] text-warning space-y-0.5">
                  {above.map(c => <div key={c.id}>{c.issuer} ••{c.last4} ({utilPercent(c).toFixed(1)}%)</div>)}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
