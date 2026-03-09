"use client"

import { useState, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, ArrowRight, Check } from "lucide-react"
import { useStore } from "@/lib/store"
import { Logo } from "@/components/logo"
import { useToast } from "@/components/toast"

type Step = "account" | "otp" | "ready"

const STEPS: { key: Step; label: string }[] = [
  { key: "account", label: "Account" },
  { key: "otp", label: "Verify" },
  { key: "ready", label: "Ready" },
]

export default function RegisterPage() {
  const { loginWithSession } = useStore()
  const { toast } = useToast()
  const router = useRouter()

  const [step, setStep] = useState<Step>("account")
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [code, setCode] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const verifyingRef = useRef(false)

  const stepIndex = STEPS.findIndex((s) => s.key === step)

  const handleAccountNext = async () => {
    setError("")
    if (!name.trim()) {
      setError("Please enter your name.")
      return
    }
    if (!email.includes("@")) {
      setError("Please enter a valid email.")
      return
    }
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

  const doVerify = useCallback(
    async (otpCode: string) => {
      if (verifyingRef.current) return
      verifyingRef.current = true
      setError("")
      setLoading(true)
      try {
        const res = await fetch("/api/auth/verify-otp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, code: otpCode }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "Invalid code")
        await loginWithSession({ ...data.user, name: name.trim() })
        setStep("ready")
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
        verifyingRef.current = false
      }
    },
    [email, name, loginWithSession]
  )

  const handleVerifyOtp = () => doVerify(code)

  const handleCodeChange = (val: string) => {
    const cleaned = val.replace(/\D/g, "").slice(0, 6)
    setCode(cleaned)
    if (cleaned.length === 6) doVerify(cleaned)
  }

  const handleFinish = () => {
    toast(`Welcome, ${name.trim().split(" ")[0]}!`)
    router.push("/onboarding")
  }

  return (
    <div className="min-h-dvh bg-[#FCFCFC] flex flex-col">
      {/* Header */}
      <header className="px-4 h-14 flex items-center gap-2.5 border-b border-border">
        <button
          onClick={() => {
            if (step === "account") router.push("/")
            else if (step === "otp") setStep("account")
            else setStep("otp")
          }}
          className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground rounded-md transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <span className="text-sm font-semibold tracking-tight text-[#1B2A4A]">
          Create Account
        </span>
      </header>

      {/* Progress */}
      <div className="px-6 pt-4 pb-2">
        <div className="flex items-center gap-1">
          {STEPS.map((s, i) => (
            <div key={s.key} className="flex-1 flex items-center gap-1">
              <div
                className={`h-1 flex-1 rounded-full transition-colors ${
                  i <= stepIndex ? "bg-blue-500" : "bg-gray-200"
                }`}
              />
            </div>
          ))}
        </div>
        <div className="text-[0.6875rem] text-muted-foreground mt-1.5">
          Step {stepIndex + 1} of {STEPS.length} -- {STEPS[stepIndex].label}
        </div>
      </div>

      {/* Step content */}
      <div className="flex-1 px-6 py-4">
        {step === "account" && (
          <div className="space-y-5">
            <div className="flex justify-center mb-2">
              <Logo size={40} />
            </div>
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-[#1B2A4A] mb-1">
                Let&apos;s get started
              </h2>
              <p className="text-sm text-muted-foreground">
                We&apos;ll send a verification code to your email.
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Full Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Smith"
                autoFocus
                className="w-full h-11 px-3 text-sm bg-white border border-border rounded-lg text-[#1B2A4A] placeholder:text-muted-foreground outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@email.com"
                className="w-full h-11 px-3 text-sm bg-white border border-border rounded-lg text-[#1B2A4A] placeholder:text-muted-foreground outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
            {error && <p className="text-xs text-red-400">{error}</p>}
            <button
              onClick={handleAccountNext}
              disabled={loading}
              className="w-full h-11 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? "Sending code..." : "Continue"}
              {!loading && <ArrowRight className="w-4 h-4" />}
            </button>
            <p className="text-center text-[0.8125rem] text-muted-foreground">
              Already have an account?{" "}
              <button
                onClick={() => router.push("/login")}
                className="font-medium text-primary hover:text-primary/80 underline underline-offset-2 transition-colors"
              >
                Sign in
              </button>
            </p>
          </div>
        )}

        {step === "otp" && (
          <div className="space-y-5">
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-[#1B2A4A] mb-1">
                Verify your email
              </h2>
              <p className="text-sm text-muted-foreground">
                Enter the 6-digit code sent to {email}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Verification code
              </label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => handleCodeChange(e.target.value)}
                autoFocus
                autoComplete="one-time-code"
                placeholder="000000"
                className="w-full h-14 px-3 text-center text-lg tracking-[0.3em] font-mono bg-white border border-border rounded-lg text-[#1B2A4A] placeholder:text-muted-foreground outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
            {error && <p className="text-xs text-red-400">{error}</p>}
            <button
              onClick={handleVerifyOtp}
              disabled={loading || code.length !== 6}
              className="w-full h-11 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? "Verifying..." : "Verify"}
              {!loading && <ArrowRight className="w-4 h-4" />}
            </button>
            <button
              onClick={handleAccountNext}
              disabled={loading}
              className="w-full text-center text-xs text-muted-foreground hover:text-foreground disabled:opacity-50 transition-colors"
            >
              Resend code
            </button>
          </div>
        )}

        {step === "ready" && (
          <div className="flex flex-col items-center justify-center text-center py-8 space-y-6">
            <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center">
              <Check className="w-8 h-8 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-[#1B2A4A] mb-1">
                You&apos;re all set, {name.trim().split(" ")[0]}!
              </h2>
              <p className="text-sm text-muted-foreground max-w-[260px] mx-auto">
                Your account is ready. Let&apos;s upload your first statements.
              </p>
            </div>
            <div className="w-full max-w-[280px] space-y-3">
              <button
                onClick={handleFinish}
                className="w-full h-11 bg-blue-500 text-white rounded-xl text-sm font-medium hover:bg-blue-600 transition-colors flex items-center justify-center gap-2"
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
