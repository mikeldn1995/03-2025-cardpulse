"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Wifi, ArrowRight, Check, AlertTriangle } from "lucide-react"
import { useStore } from "@/lib/store"
import { useToast } from "@/components/toast"
import { cn } from "@/lib/utils"
import { CreditCard as CreditCardType } from "@/types/card"

type Step = "welcome" | "profile" | "add-card" | "done"

export default function OnboardingPage() {
  const { userName, currency, setUserName, setCurrency, setOnboarded, addCard } = useStore()
  const { toast } = useToast()
  const router = useRouter()
  const searchParams = useSearchParams()

  const tlError = searchParams.get("tl_error")
  const tlConnected = searchParams.get("tl_connected")

  const [step, setStep] = useState<Step>(() => {
    if (tlConnected === "1") return "done"
    if (tlError) return "add-card"
    return "welcome"
  })

  const [nameInput, setNameInput] = useState(userName)
  const [selectedCurrency, setSelectedCurrency] = useState(currency)

  // Card form
  const [formIssuer, setFormIssuer] = useState("")
  const [formLast4, setFormLast4] = useState("")
  const [formLimit, setFormLimit] = useState("")
  const [formBalance, setFormBalance] = useState("")
  const [formAPR, setFormAPR] = useState("")
  const [showManualForm, setShowManualForm] = useState(false)

  // If TrueLayer connected successfully, show done with success context
  const [connectedViaBank, setConnectedViaBank] = useState(tlConnected === "1")

  const handleProfileNext = () => {
    const trimmed = nameInput.trim()
    if (trimmed) setUserName(trimmed)
    setCurrency(selectedCurrency)
    setStep("add-card")
  }

  const handleAddManualCard = () => {
    const issuer = formIssuer.trim()
    if (!issuer) { toast("Enter card issuer name"); return }

    const card: CreditCardType = {
      id: Date.now(),
      issuer,
      last4: formLast4 || "0000",
      openingBalance: parseFloat(formBalance) || 0,
      openingMonth: new Date().toISOString().substring(0, 7),
      limit: parseFloat(formLimit) || 0,
      aprRegular: parseFloat(formAPR) || 0,
      aprPromo: null,
      promoUntil: null,
      dd: "none",
      ddAmount: 0,
      paymentDay: 5,
      statementDay: 1,
      source: "manual",
      tlAccountId: null,
      minPaymentOverride: null,
      monthlyRecords: [],
    }

    addCard(card)
    toast(`${issuer} added`)
    setStep("done")
  }

  const handleFinish = () => {
    setOnboarded(true)
    router.push("/dashboard")
  }

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-4">
      {step === "welcome" && (
        <div className="w-full max-w-sm text-center space-y-6">
          <div className="w-16 h-16 bg-foreground text-background rounded-2xl inline-flex items-center justify-center text-2xl font-bold mx-auto">
            CP
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Welcome to CardPulse</h1>
            <p className="text-sm text-muted-foreground mt-2">
              Track your credit cards, monitor balances, and forecast your repayment timeline.
            </p>
          </div>
          <button
            onClick={() => setStep("profile")}
            className="w-full flex items-center justify-center gap-2 py-3 text-sm font-medium bg-foreground text-background rounded-lg hover:opacity-90 transition-opacity"
          >
            Get Started
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {step === "profile" && (
        <div className="w-full max-w-sm space-y-6">
          <div>
            <h2 className="text-xl font-bold tracking-tight">About you</h2>
            <p className="text-sm text-muted-foreground mt-1">Quick setup before we begin.</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-[0.6875rem] uppercase tracking-wider text-muted-foreground font-medium block mb-1.5">Your Name</label>
              <input
                type="text"
                value={nameInput}
                onChange={e => setNameInput(e.target.value)}
                placeholder="Enter your name"
                autoFocus
                className="w-full h-10 px-3 text-sm bg-background border border-border rounded-md outline-none focus:border-ring"
              />
            </div>

            <div>
              <label className="text-[0.6875rem] uppercase tracking-wider text-muted-foreground font-medium block mb-1.5">Currency</label>
              <div className="flex gap-1">
                {(["GBP", "USD", "EUR"] as const).map(c => (
                  <button
                    key={c}
                    onClick={() => setSelectedCurrency(c)}
                    className={cn(
                      "flex-1 py-2.5 text-sm font-medium rounded-md transition-colors",
                      selectedCurrency === c
                        ? "bg-foreground text-background"
                        : "bg-secondary text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button
            onClick={handleProfileNext}
            className="w-full flex items-center justify-center gap-2 py-3 text-sm font-medium bg-foreground text-background rounded-lg hover:opacity-90 transition-opacity"
          >
            Next
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {step === "add-card" && (
        <div className="w-full max-w-sm space-y-6">
          <div>
            <h2 className="text-xl font-bold tracking-tight">Add your first card</h2>
            <p className="text-sm text-muted-foreground mt-1">Connect your bank or enter card details manually.</p>
          </div>

          {tlError && (
            <div className="flex items-start gap-3 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm">
              <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
              <div className="space-y-2">
                <p className="text-foreground">{tlError}</p>
                <div className="flex gap-3">
                  <a
                    href="/api/truelayer/connect"
                    className="text-xs font-medium underline text-foreground"
                  >
                    Try again
                  </a>
                  <button
                    onClick={() => setShowManualForm(true)}
                    className="text-xs font-medium underline text-muted-foreground"
                  >
                    Skip to manual
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-3">
            <a
              href="/api/truelayer/connect"
              className="w-full flex items-center gap-3 py-3 px-4 text-sm font-medium bg-success/10 border border-success/20 rounded-lg hover:bg-success/15 transition-colors"
            >
              <Wifi className="w-5 h-5 text-success" />
              <div className="text-left">
                <div>Connect your bank</div>
                <div className="text-[0.6875rem] text-muted-foreground font-normal">Auto-import cards with live balances</div>
              </div>
            </a>

            {!showManualForm ? (
              <button
                onClick={() => setShowManualForm(true)}
                className="w-full text-xs text-muted-foreground underline py-1"
              >
                or add a card manually
              </button>
            ) : (
              <>
                <div className="text-center text-xs text-muted-foreground py-1">or add manually</div>
                <div className="bg-card border border-border rounded-lg p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="col-span-2">
                      <FieldLabel>Card Issuer</FieldLabel>
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
                  </div>
                  <button
                    onClick={handleAddManualCard}
                    className="w-full h-9 bg-foreground text-background rounded-md text-sm font-medium hover:opacity-90 transition-opacity"
                  >
                    Add Card
                  </button>
                </div>
              </>
            )}
          </div>

          <button onClick={() => setStep("done")} className="w-full text-xs text-muted-foreground underline">
            Skip -- I'll add cards later
          </button>
        </div>
      )}

      {step === "done" && (
        <div className="w-full max-w-sm text-center space-y-6">
          <div className="w-16 h-16 bg-success/10 text-success rounded-full inline-flex items-center justify-center mx-auto">
            <Check className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight">You're all set!</h2>
            <p className="text-sm text-muted-foreground mt-2">
              {connectedViaBank
                ? "Your bank account has been connected. Cards will sync automatically."
                : "You can always add more cards and connect your bank in Settings."
              }
            </p>
          </div>
          <button
            onClick={handleFinish}
            className="w-full flex items-center justify-center gap-2 py-3 text-sm font-medium bg-foreground text-background rounded-lg hover:opacity-90 transition-opacity"
          >
            Go to Dashboard
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-[0.625rem] uppercase tracking-wider text-muted-foreground font-medium mb-1">{children}</div>
}
