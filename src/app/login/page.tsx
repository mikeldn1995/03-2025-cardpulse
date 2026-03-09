"use client"

import { useState, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { useStore } from "@/lib/store"
import { Logo } from "@/components/logo"
import { useToast } from "@/components/toast"
import { ArrowLeft } from "lucide-react"

export default function LoginPage() {
  const { loginWithSession } = useStore()
  const { toast } = useToast()
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [code, setCode] = useState("")
  const [step, setStep] = useState<"email" | "otp">("email")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const verifyingRef = useRef(false)

  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    setError("")
    setLoading(true)
    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to send code")
      setStep("otp")
      toast("Check your email for the sign-in code")
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const doVerify = useCallback(async (otpCode: string) => {
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
      await loginWithSession(data.user)
      toast(`Welcome back, ${data.user.name || "there"}!`)
      router.push("/dashboard")
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
      verifyingRef.current = false
    }
  }, [email, loginWithSession, toast, router])

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    doVerify(code)
  }

  const handleCodeChange = (val: string) => {
    const cleaned = val.replace(/\D/g, "").slice(0, 6)
    setCode(cleaned)
    if (cleaned.length === 6) doVerify(cleaned)
  }

  return (
    <div className="min-h-dvh bg-[#FCFCFC] flex items-center justify-center px-6">
      <div className="w-full max-w-[360px]">
        <div className="text-center mb-10">
          <Logo size={48} className="mx-auto mb-4" />
          <h1 className="text-2xl font-semibold tracking-tight text-[#1B2A4A]">
            {step === "email" ? "Welcome back" : "Enter your code"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1.5">
            {step === "email"
              ? "Sign in with a one-time code sent to your email."
              : `We sent a 6-digit code to ${email}`}
          </p>
        </div>

        {step === "email" ? (
          <form onSubmit={handleSendOtp} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                placeholder="you@email.com"
                className="w-full h-11 px-3 text-sm bg-white border border-border rounded-lg text-[#1B2A4A] placeholder:text-muted-foreground outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
            {error && <p className="text-xs text-red-400">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors disabled:opacity-50"
            >
              {loading ? "Sending..." : "Send sign-in code"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                6-digit code
              </label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => handleCodeChange(e.target.value)}
                required
                autoFocus
                autoComplete="one-time-code"
                placeholder="000000"
                className="w-full h-14 px-3 text-center text-lg tracking-[0.3em] font-mono bg-white border border-border rounded-lg text-[#1B2A4A] placeholder:text-muted-foreground outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
            {error && <p className="text-xs text-red-400">{error}</p>}
            <button
              type="submit"
              disabled={loading || code.length !== 6}
              className="w-full h-11 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors disabled:opacity-50"
            >
              {loading ? "Verifying..." : "Verify & sign in"}
            </button>
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  setStep("email")
                  setCode("")
                  setError("")
                }}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
              >
                <ArrowLeft className="w-3 h-3" /> Change email
              </button>
              <button
                type="button"
                onClick={() => handleSendOtp()}
                disabled={loading}
                className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-50 transition-colors"
              >
                Resend code
              </button>
            </div>
          </form>
        )}

        <div className="text-center mt-8">
          <p className="text-[0.8125rem] text-muted-foreground">
            Don&apos;t have an account?{" "}
            <button
              onClick={() => router.push("/register")}
              className="font-medium text-primary hover:text-primary/80 underline underline-offset-2 transition-colors"
            >
              Create one
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
