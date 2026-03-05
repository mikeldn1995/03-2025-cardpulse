"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useStore } from "@/lib/store"
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

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault()
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

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault()
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
      await loginWithSession(data.user)
      toast(`Welcome back, ${data.user.name || "there"}!`)
      router.push("/dashboard")
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex-1 flex items-center justify-center px-6 min-h-dvh">
      <div className="w-full max-w-[360px]">
        <div className="text-center mb-10">
          <div className="w-12 h-12 bg-foreground text-background rounded-lg inline-flex items-center justify-center text-xl font-bold mb-3">CP</div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {step === "email" ? "Welcome back" : "Enter your code"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {step === "email"
              ? "Sign in with a one-time code sent to your email."
              : `We sent a 6-digit code to ${email}`}
          </p>
        </div>

        {step === "email" ? (
          <form onSubmit={handleSendOtp} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoFocus
                placeholder="you@email.com"
                className="w-full h-10 px-3 text-sm bg-transparent border border-border rounded-lg outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
              />
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-10 bg-foreground text-background rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {loading ? "Sending..." : "Send sign-in code"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">6-digit code</label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, ""))}
                required
                autoFocus
                placeholder="000000"
                className="w-full h-12 px-3 text-center text-lg tracking-[0.3em] font-mono bg-transparent border border-border rounded-lg outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
              />
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <button
              type="submit"
              disabled={loading || code.length !== 6}
              className="w-full h-10 bg-foreground text-background rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {loading ? "Verifying..." : "Verify & sign in"}
            </button>
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => { setStep("email"); setCode(""); setError("") }}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                <ArrowLeft className="w-3 h-3" /> Change email
              </button>
              <button
                type="button"
                onClick={handleSendOtp}
                disabled={loading}
                className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
              >
                Resend code
              </button>
            </div>
          </form>
        )}

        <div className="text-center mt-6">
          <p className="text-[0.8125rem] text-muted-foreground">
            Don't have an account?{" "}
            <button onClick={() => router.push("/register")} className="font-medium text-foreground underline underline-offset-2">
              Create one
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
