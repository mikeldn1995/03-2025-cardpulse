"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { LogOut, RotateCcw, Moon, Sun, Monitor, Unlink, Loader2, Plus, CreditCard, Wifi, Link, AlertTriangle } from "lucide-react"
import { useStore } from "@/lib/store"
import { useToast } from "@/components/toast"
import { cn, currencySymbol } from "@/lib/utils"
import { CreditCard as CreditCardType } from "@/types/card"

export default function SettingsPage() {
  const {
    currency, theme, utilThreshold, userName, userEmail, cards,
    setCurrency, setTheme, setUtilThreshold, setUserName,
    addCard, resetCards, logout,
  } = useStore()
  const { toast } = useToast()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [confirmReset, setConfirmReset] = useState(false)
  const [confirmLogout, setConfirmLogout] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState(userName)

  // TrueLayer state
  const [tlConnected, setTlConnected] = useState<boolean | null>(null)
  const [tlLoading, setTlLoading] = useState(false)
  const [tlError, setTlError] = useState<string | null>(null)

  // Add card flow state
  const [flowOpen, setFlowOpen] = useState(false)
  const [flowStep, setFlowStep] = useState<"idle" | "tl-error" | "tl-select" | "manual">("idle")
  const [tlDiscoveredCards, setTlDiscoveredCards] = useState<any[]>([])
  const [selectedTlCard, setSelectedTlCard] = useState<any>(null)

  // Manual card form
  const [formIssuer, setFormIssuer] = useState("")
  const [formLast4, setFormLast4] = useState("")
  const [formLimit, setFormLimit] = useState("")
  const [formBalance, setFormBalance] = useState("")
  const [formAPR, setFormAPR] = useState("")
  const [formPaymentDay, setFormPaymentDay] = useState("5")
  const [formStatementDay, setFormStatementDay] = useState("1")
  const [formDD, setFormDD] = useState<CreditCardType["dd"]>("none")
  const [formDDAmount, setFormDDAmount] = useState("")

  useEffect(() => {
    fetch("/api/truelayer/status")
      .then(r => r.json())
      .then(d => setTlConnected(d.connected))
      .catch(() => setTlConnected(false))

    if (searchParams.get("tl_connected")) {
      setTlConnected(true)
      toast("Bank connected")
      fetch("/api/truelayer/status")
        .then(r => r.json())
        .then(d => setTlConnected(d.connected))
        .catch(() => {})
    }

    const tlErrorParam = searchParams.get("tl_error")
    if (tlErrorParam) {
      setTlError(tlErrorParam)
      setFlowOpen(true)
      setFlowStep("tl-error")
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleTlDisconnect = async () => {
    setTlLoading(true)
    try {
      await fetch("/api/truelayer/disconnect", { method: "POST" })
      setTlConnected(false)
      toast("Bank account disconnected")
    } catch { toast("Failed to disconnect") }
    finally { setTlLoading(false) }
  }

  const handleLogout = () => {
    if (!confirmLogout) { setConfirmLogout(true); return }
    logout()
    router.push("/login")
  }

  const handleReset = () => {
    if (!confirmReset) { setConfirmReset(true); return }
    resetCards()
    setConfirmReset(false)
    toast("All cards removed")
  }

  const handleAddNewCard = () => {
    setFlowOpen(true)
    if (tlConnected) {
      // Already connected -- show choice between import and manual
      setFlowStep("idle")
    } else {
      // Not connected -- try TrueLayer first
      window.location.href = "/api/truelayer/connect"
    }
  }

  const handleImportFromBank = () => {
    fetch("/api/truelayer/balances")
      .then(r => r.json())
      .then(d => {
        if (d.connected && d.cards) {
          const existingLast4s = new Set(cards.filter(c => c.source === "truelayer").map(c => c.last4))
          const available = d.cards.filter((tc: any) => !existingLast4s.has(tc.partialNumber?.slice(-4) || ""))
          setTlDiscoveredCards(available)
          setFlowStep("tl-select")
        }
      })
      .catch(() => toast("Failed to fetch bank cards"))
  }

  const selectTlCard = (tc: any) => {
    setSelectedTlCard(tc)
    setFormIssuer(tc.displayName || tc.cardNetwork || "")
    setFormLast4(tc.partialNumber?.slice(-4) || "0000")
    setFormLimit(tc.balance?.creditLimit?.toString() || "")
    setFormBalance(tc.balance?.current?.toString() || "0")
    setFlowStep("manual")
  }

  const handleSaveCard = () => {
    const issuer = formIssuer.trim()
    if (!issuer) { toast("Issuer name required"); return }

    const newCard: CreditCardType = {
      id: Date.now(),
      issuer,
      last4: formLast4 || "0000",
      openingBalance: parseFloat(formBalance) || 0,
      openingMonth: new Date().toISOString().substring(0, 7),
      limit: parseFloat(formLimit) || 0,
      aprRegular: parseFloat(formAPR) || 0,
      aprPromo: null,
      promoUntil: null,
      dd: formDD,
      ddAmount: parseFloat(formDDAmount) || 0,
      paymentDay: parseInt(formPaymentDay) || 5,
      statementDay: parseInt(formStatementDay) || 1,
      source: selectedTlCard ? "truelayer" : "manual",
      tlAccountId: selectedTlCard?.accountId || null,
      minPaymentOverride: null,
      monthlyRecords: [],
    }

    addCard(newCard)
    toast(`${issuer} added`)
    resetFlow()
  }

  const resetFlow = () => {
    setFlowOpen(false)
    setFlowStep("idle")
    setTlError(null)
    setSelectedTlCard(null)
    setTlDiscoveredCards([])
    setFormIssuer("")
    setFormLast4("")
    setFormLimit("")
    setFormBalance("")
    setFormAPR("")
    setFormPaymentDay("5")
    setFormStatementDay("1")
    setFormDD("none")
    setFormDDAmount("")
  }

  return (
    <>
      <div className="pb-3">
        <p className="text-[0.8125rem] text-muted-foreground">Preferences and account</p>
      </div>

      <div className="space-y-3">
        {/* Profile */}
        <Section title="Profile">
          <div className="flex items-center gap-3 py-1">
            <div className="w-10 h-10 rounded-full bg-foreground/10 flex items-center justify-center text-sm font-semibold">
              {(userName || userEmail || "?")[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              {editingName ? (
                <form className="flex items-center gap-1.5" onSubmit={e => {
                  e.preventDefault()
                  const trimmed = nameInput.trim()
                  if (trimmed) { setUserName(trimmed); toast("Name updated") }
                  setEditingName(false)
                }}>
                  <input
                    type="text"
                    value={nameInput}
                    onChange={e => setNameInput(e.target.value)}
                    autoFocus
                    className="h-7 w-full px-2 text-sm bg-background border border-ring rounded-md outline-none"
                  />
                  <button type="submit" className="text-xs font-medium text-foreground underline shrink-0">Save</button>
                  <button type="button" onClick={() => { setEditingName(false); setNameInput(userName) }} className="text-xs text-muted-foreground underline shrink-0">Cancel</button>
                </form>
              ) : (
                <div
                  className="text-sm font-medium cursor-pointer border-b border-dashed border-transparent hover:border-border pb-px"
                  onClick={() => { setNameInput(userName); setEditingName(true) }}
                >
                  {userName || "Set your name"}
                </div>
              )}
              <div className="text-xs text-muted-foreground">{userEmail || "demo@cardpulse.io"}</div>
              <div className="text-[0.6875rem] text-muted-foreground/60">{cards.length} card{cards.length !== 1 ? "s" : ""} linked</div>
            </div>
          </div>
        </Section>

        {/* Cards & Banking */}
        <Section title="Cards & Banking">
          {/* Bank connection status */}
          <div className="flex items-center gap-2 text-sm mb-3">
            {tlConnected === null ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                <span className="text-muted-foreground">Checking bank connection...</span>
              </>
            ) : (
              <>
                <div className={cn("w-2 h-2 rounded-full shrink-0", tlConnected ? "bg-success" : "bg-muted-foreground/40")} />
                <span className="font-medium">{tlConnected ? "Bank connected" : "No bank connected"}</span>
              </>
            )}
          </div>

          {!flowOpen ? (
            <div className="space-y-2">
              <button
                onClick={handleAddNewCard}
                className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-medium bg-foreground text-background rounded-md hover:opacity-90 transition-opacity"
              >
                <Plus className="w-4 h-4" />
                Add a new card
              </button>
              {tlConnected && (
                <button
                  onClick={handleTlDisconnect}
                  disabled={tlLoading}
                  className="flex items-center gap-1.5 text-xs text-destructive hover:underline disabled:opacity-50 mt-1"
                >
                  <Unlink className="w-3 h-3" />
                  {tlLoading ? "Disconnecting..." : "Disconnect bank"}
                </button>
              )}
            </div>
          ) : flowStep === "tl-error" ? (
            /* TrueLayer connection failed */
            <div className="space-y-3">
              <div className="flex items-start gap-2.5 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-destructive">Bank connection failed</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{tlError || "An unknown error occurred"}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <a
                  href="/api/truelayer/connect"
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium bg-foreground text-background rounded-md hover:opacity-90 transition-opacity"
                >
                  <Link className="w-3.5 h-3.5" />
                  Try again
                </a>
                <button
                  onClick={() => { setTlError(null); setFlowStep("manual") }}
                  className="flex-1 py-2.5 text-sm font-medium border border-border rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                >
                  Add card manually instead
                </button>
              </div>
              <button onClick={resetFlow} className="w-full text-xs text-muted-foreground underline">Cancel</button>
            </div>
          ) : flowStep === "idle" && tlConnected ? (
            /* Connected: choose import or manual */
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground mb-3">How would you like to add this card?</p>
              <button
                onClick={handleImportFromBank}
                className="w-full flex items-center gap-3 py-3 px-3 text-sm font-medium bg-success/10 border border-success/20 rounded-md hover:bg-success/15 transition-colors"
              >
                <Wifi className="w-4 h-4 text-success" />
                <div className="text-left">
                  <div>Import from bank</div>
                  <div className="text-[0.6875rem] text-muted-foreground font-normal">Auto-fills from your connected account</div>
                </div>
              </button>
              <button
                onClick={() => setFlowStep("manual")}
                className="w-full flex items-center gap-3 py-3 px-3 text-sm font-medium bg-secondary border border-border rounded-md hover:bg-accent transition-colors"
              >
                <CreditCard className="w-4 h-4" />
                <div className="text-left">
                  <div>Add manually</div>
                  <div className="text-[0.6875rem] text-muted-foreground font-normal">For cards not in your connected bank</div>
                </div>
              </button>
              <button onClick={resetFlow} className="w-full text-xs text-muted-foreground mt-1 underline">Cancel</button>
            </div>
          ) : flowStep === "tl-select" ? (
            /* Pick a discovered card from bank */
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground mb-2">Select a card from your bank:</p>
              {tlDiscoveredCards.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">No new cards found. All bank cards are already added.</p>
              ) : (
                tlDiscoveredCards.map((tc: any, i: number) => (
                  <button
                    key={i}
                    onClick={() => selectTlCard(tc)}
                    className="w-full flex items-center justify-between py-2.5 px-3 text-sm bg-secondary border border-border rounded-md hover:bg-accent transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Wifi className="w-3 h-3 text-success" />
                      <span className="font-medium">{tc.displayName || tc.cardNetwork}</span>
                      <span className="text-xs text-muted-foreground font-mono">--{tc.partialNumber?.slice(-4)}</span>
                    </div>
                  </button>
                ))
              )}
              <div className="flex gap-2 mt-1">
                <button onClick={() => setFlowStep("idle")} className="text-xs text-muted-foreground underline">Back</button>
                <button onClick={() => setFlowStep("manual")} className="text-xs text-muted-foreground underline">Add manually instead</button>
              </div>
            </div>
          ) : flowStep === "manual" ? (
            /* Manual card form */
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground mb-1">
                {selectedTlCard ? "Fill in the remaining details:" : "Enter card details:"}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div className="col-span-2">
                  <FieldLabel>Card Issuer / Name</FieldLabel>
                  <input type="text" value={formIssuer} onChange={e => setFormIssuer(e.target.value)} placeholder="e.g. Barclaycard"
                    className="w-full h-8 px-2.5 text-sm bg-background border border-border rounded-md outline-none focus:border-ring" />
                </div>
                <div>
                  <FieldLabel>Last 4 Digits</FieldLabel>
                  <input type="text" value={formLast4} onChange={e => setFormLast4(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="1234" maxLength={4}
                    className="w-full h-8 px-2.5 text-sm bg-background border border-border rounded-md outline-none focus:border-ring font-mono" />
                </div>
                <div>
                  <FieldLabel>Credit Limit</FieldLabel>
                  <input type="number" value={formLimit} onChange={e => setFormLimit(e.target.value)} placeholder="0"
                    className="w-full h-8 px-2.5 text-sm bg-background border border-border rounded-md outline-none focus:border-ring" />
                </div>
                <div>
                  <FieldLabel>Current Balance</FieldLabel>
                  <input type="number" value={formBalance} onChange={e => setFormBalance(e.target.value)} placeholder="0"
                    className="w-full h-8 px-2.5 text-sm bg-background border border-border rounded-md outline-none focus:border-ring" />
                </div>
                <div>
                  <FieldLabel>APR (%)</FieldLabel>
                  <input type="number" step="0.1" value={formAPR} onChange={e => setFormAPR(e.target.value)} placeholder="0"
                    className="w-full h-8 px-2.5 text-sm bg-background border border-border rounded-md outline-none focus:border-ring" />
                </div>
                <div>
                  <FieldLabel>Payment Day (1-28)</FieldLabel>
                  <input type="number" min="1" max="28" value={formPaymentDay} onChange={e => setFormPaymentDay(e.target.value)}
                    className="w-full h-8 px-2.5 text-sm bg-background border border-border rounded-md outline-none focus:border-ring" />
                </div>
                <div>
                  <FieldLabel>Statement Day (1-28)</FieldLabel>
                  <input type="number" min="1" max="28" value={formStatementDay} onChange={e => setFormStatementDay(e.target.value)}
                    className="w-full h-8 px-2.5 text-sm bg-background border border-border rounded-md outline-none focus:border-ring" />
                </div>
              </div>
              <div>
                <FieldLabel>Direct Debit</FieldLabel>
                <div className="flex gap-1.5 flex-wrap mt-1">
                  {(["none", "minimum", "custom", "full"] as const).map(opt => (
                    <button key={opt} onClick={() => setFormDD(opt)}
                      className={cn("px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors",
                        formDD === opt ? "bg-foreground text-background" : "bg-secondary text-muted-foreground hover:text-foreground"
                      )}>
                      {opt === "none" ? "None" : opt === "minimum" ? "Minimum" : opt === "custom" ? "Custom" : "Full"}
                    </button>
                  ))}
                </div>
                {formDD === "custom" && (
                  <input type="number" value={formDDAmount} onChange={e => setFormDDAmount(e.target.value)} placeholder={`${currencySymbol(currency)}0`}
                    className="w-24 h-7 px-2 text-sm bg-background border border-border rounded-md outline-none focus:border-ring mt-2" />
                )}
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={handleSaveCard}
                  className="flex-1 h-9 bg-foreground text-background rounded-md text-sm font-medium hover:opacity-90 transition-opacity">
                  Save Card
                </button>
                <button onClick={resetFlow}
                  className="h-9 px-4 text-sm text-muted-foreground border border-border rounded-md hover:bg-accent transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            /* flowStep === "idle" && not connected -- shouldn't normally render (redirect happens), fallback */
            <div className="space-y-2">
              <button
                onClick={() => setFlowStep("manual")}
                className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-medium bg-secondary border border-border rounded-md hover:bg-accent transition-colors"
              >
                <CreditCard className="w-4 h-4" />
                Skip -- add manually
              </button>
              <button onClick={resetFlow} className="w-full text-xs text-muted-foreground underline">Cancel</button>
            </div>
          )}
        </Section>

        {/* Theme */}
        <Section title="Appearance">
          <div className="flex gap-1">
            {([
              { key: "system" as const, label: "System", icon: Monitor },
              { key: "light" as const, label: "Light", icon: Sun },
              { key: "dark" as const, label: "Dark", icon: Moon },
            ]).map(t => (
              <button
                key={t.key}
                onClick={() => { setTheme(t.key); toast(`Theme: ${t.label}`) }}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-md transition-colors",
                  theme === t.key
                    ? "bg-foreground text-background"
                    : "bg-secondary text-muted-foreground hover:text-foreground"
                )}
              >
                <t.icon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            ))}
          </div>
        </Section>

        {/* Currency */}
        <Section title="Currency">
          <div className="flex gap-1">
            {(["GBP", "USD", "EUR"] as const).map(c => (
              <button
                key={c}
                onClick={() => { setCurrency(c); toast(`Currency: ${c}`) }}
                className={cn(
                  "flex-1 py-2 text-xs font-medium rounded-md transition-colors",
                  currency === c
                    ? "bg-foreground text-background"
                    : "bg-secondary text-muted-foreground hover:text-foreground"
                )}
              >
                {c}
              </button>
            ))}
          </div>
        </Section>

        {/* Utilization threshold */}
        <Section title="Utilization Threshold">
          <div className="flex items-center gap-3">
            <input
              type="range"
              min="10"
              max="90"
              step="5"
              value={utilThreshold}
              onChange={e => setUtilThreshold(parseInt(e.target.value))}
              className="flex-1 h-1.5 accent-foreground"
            />
            <span className="text-sm font-semibold tabular-nums w-10 text-right">{utilThreshold}%</span>
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            Cards above this are flagged as high utilization
          </div>
        </Section>

        {/* Data */}
        <Section title="Data">
          <button
            onClick={handleReset}
            className={cn(
              "w-full flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-md transition-colors",
              confirmReset
                ? "bg-destructive/10 text-destructive border border-destructive/30"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            )}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            {confirmReset ? "Tap again to confirm reset" : "Remove all cards"}
          </button>
          {confirmReset && (
            <button onClick={() => setConfirmReset(false)} className="w-full text-xs text-muted-foreground mt-1 underline">
              Cancel
            </button>
          )}
        </Section>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className={cn(
            "w-full flex items-center justify-center gap-2 py-3 text-sm font-medium rounded-lg transition-colors",
            confirmLogout
              ? "bg-destructive text-destructive-foreground"
              : "bg-card border border-border text-destructive hover:bg-destructive/10"
          )}
        >
          <LogOut className="w-4 h-4" />
          {confirmLogout ? "Tap again to log out" : "Log Out"}
        </button>
        {confirmLogout && (
          <button onClick={() => setConfirmLogout(false)} className="w-full text-xs text-muted-foreground text-center mt-1 underline">
            Cancel
          </button>
        )}

        {/* Version */}
        <div className="text-center text-[0.625rem] text-muted-foreground/60 pt-2 pb-20">
          CardPulse v3.0.0
        </div>
      </div>
    </>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="text-[0.6875rem] uppercase tracking-wider text-muted-foreground font-medium mb-2.5">
        {title}
      </div>
      {children}
    </div>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-[0.625rem] uppercase tracking-wider text-muted-foreground font-medium mb-1">{children}</div>
}
