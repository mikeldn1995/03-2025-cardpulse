"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, ArrowRight, Check } from "lucide-react"
import { useStore } from "@/lib/store"
import { useToast } from "@/components/toast"
import { cn } from "@/lib/utils"

type Step = "account" | "otp" | "preferences" | "ready"

const STEPS: { key: Step; label: string }[] = [
  { key: "account", label: "Account" },
  { key: "otp", label: "Verify" },
  { key: "preferences", label: "Preferences" },
  { key: "ready", label: "Ready" },
]

export default function RegisterPage() {
  const { loginWithSession, setCurrency, setTheme } = useStore()
  const { toast } = useToast()
  const router = useRouter()

  const [step, setStep] = useState<Step>("account")
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [code, setCode] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const [selectedCurrency, setSelectedCurrency] = useState<"GBP" | "USD" | "EUR">("GBP")
  const [selectedTheme, setSelectedTheme] = useState<"system" | "light" | "dark">("system")

  const stepIndex = STEPS.findIndex(s => s.key === step)

  const handleAccountNext = async () => {
    setError("")
    if (!name.trim()) { setError("Please enter your name."); return }
    if (!email.includes("@")) { setError("Please enter a valid email."); return }
    setLoading(true)
    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to send code")
      toast("Check your email for the verification code")
      setStep("otp")
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOtp = async () => {
    setError("")
    setLoading(true)
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Invalid code")
      await loginWithSession({ ...data.user, name: name.trim() })
      setStep("preferences")
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handlePreferencesNext = () => {
    setCurrency(selectedCurrency)
    setTheme(selectedTheme)
    setStep("ready")
  }

  const handleFinish = () => {
    toast(`Welcome, ${name.trim().split(" ")[0]}!`)
    router.push("/dashboard")
  }

  return (
    <div className="flex-1 flex flex-col min-h-dvh">
      {/* Header */}
      <header className="px-4 h-14 flex items-center gap-2.5 border-b border-border">
        <button
          onClick={() => {
            if (step === "account") router.push("/")
            else if (step === "otp") setStep("account")
            else if (step === "preferences") setStep("otp")
            else setStep("preferences")
          }}
          className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground rounded-md transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <span className="text-sm font-semibold tracking-tight">Create Account</span>
      </header>

      {/* Progress */}
      <div className="px-6 pt-4 pb-2">
        <div className="flex items-center gap-1">
          {STEPS.map((s, i) => (
            <div key={s.key} className="flex-1 flex items-center gap-1">
              <div className={cn(
                "h-1 flex-1 rounded-full transition-colors",
                i <= stepIndex ? "bg-foreground" : "bg-border"
              )} />
            </div>
          ))}
        </div>
        <div className="text-[0.6875rem] text-muted-foreground mt-1.5">
          Step {stepIndex + 1} of {STEPS.length} — {STEPS[stepIndex].label}
        </div>
      </div>

      {/* Step content */}
      <div className="flex-1 px-6 py-4">
        {step === "account" && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold tracking-tight mb-1">Let's get started</h2>
              <p className="text-sm text-muted-foreground">We'll send a verification code to your email.</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Full Name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="John Smith"
                autoFocus
                className="w-full h-10 px-3 text-sm bg-transparent border border-border rounded-lg outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@email.com"
                className="w-full h-10 px-3 text-sm bg-transparent border border-border rounded-lg outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
              />
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <button
              onClick={handleAccountNext}
              disabled={loading}
              className="w-full h-10 bg-foreground text-background rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? "Sending code..." : "Continue"}
              {!loading && <ArrowRight className="w-4 h-4" />}
            </button>
            <p className="text-center text-[0.8125rem] text-muted-foreground">
              Already have an account?{" "}
              <button onClick={() => router.push("/login")} className="font-medium text-foreground underline underline-offset-2">Sign in</button>
            </p>
          </div>
        )}

        {step === "otp" && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold tracking-tight mb-1">Verify your email</h2>
              <p className="text-sm text-muted-foreground">Enter the 6-digit code sent to {email}</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Verification code</label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, ""))}
                autoFocus
                placeholder="000000"
                className="w-full h-12 px-3 text-center text-lg tracking-[0.3em] font-mono bg-transparent border border-border rounded-lg outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
              />
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <button
              onClick={handleVerifyOtp}
              disabled={loading || code.length !== 6}
              className="w-full h-10 bg-foreground text-background rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? "Verifying..." : "Verify"}
              {!loading && <ArrowRight className="w-4 h-4" />}
            </button>
            <button
              onClick={handleAccountNext}
              disabled={loading}
              className="w-full text-center text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
            >
              Resend code
            </button>
          </div>
        )}

        {step === "preferences" && (
          <div className="space-y-5">
            <div>
              <h2 className="text-xl font-semibold tracking-tight mb-1">Preferences</h2>
              <p className="text-sm text-muted-foreground">You can change these anytime in Settings.</p>
            </div>

            <div>
              <label className="block text-[0.6875rem] uppercase tracking-wider text-muted-foreground font-medium mb-2">Currency</label>
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
                    {c === "GBP" ? "£ GBP" : c === "USD" ? "$ USD" : "€ EUR"}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[0.6875rem] uppercase tracking-wider text-muted-foreground font-medium mb-2">Appearance</label>
              <div className="flex gap-1">
                {(["system", "light", "dark"] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setSelectedTheme(t)}
                    className={cn(
                      "flex-1 py-2.5 text-sm font-medium rounded-md transition-colors capitalize",
                      selectedTheme === t
                        ? "bg-foreground text-background"
                        : "bg-secondary text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handlePreferencesNext}
              className="w-full h-10 bg-foreground text-background rounded-lg text-sm font-medium hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
            >
              Continue
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {step === "ready" && (
          <div className="flex flex-col items-center justify-center text-center py-8 space-y-6">
            <div className="w-16 h-16 bg-success/10 rounded-full flex items-center justify-center">
              <Check className="w-8 h-8 text-success" />
            </div>
            <div>
              <h2 className="text-xl font-semibold tracking-tight mb-1">You're all set, {name.trim().split(" ")[0]}!</h2>
              <p className="text-sm text-muted-foreground max-w-[260px] mx-auto">
                Your account is ready. Start adding your credit cards to track everything.
              </p>
            </div>
            <div className="w-full max-w-[280px] space-y-3">
              <button
                onClick={handleFinish}
                className="w-full h-11 bg-foreground text-background rounded-lg text-sm font-medium hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
              >
                Go to Dashboard
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
