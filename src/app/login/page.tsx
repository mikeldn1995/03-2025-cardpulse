"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useStore } from "@/lib/store"
import { useToast } from "@/components/toast"

export default function LoginPage() {
  const { login } = useStore()
  const { toast } = useToast()
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [remember, setRemember] = useState(true)
  const [error, setError] = useState("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (login(email, password, remember)) {
      toast("Welcome back, Dmitry")
      router.push("/dashboard")
    } else {
      setError("Invalid email or password.")
    }
  }

  return (
    <div className="flex-1 flex items-center justify-center px-6 min-h-dvh">
      <div className="w-full max-w-[360px]">
        <div className="text-center mb-10">
          <div className="w-12 h-12 bg-foreground text-background rounded-lg inline-flex items-center justify-center text-xl font-bold mb-3">CP</div>
          <h1 className="text-2xl font-semibold tracking-tight">CardPulse</h1>
          <p className="text-sm text-muted-foreground mt-1">Track your credit, stay in control.</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@email.com"
              className="w-full h-10 px-3 text-sm bg-transparent border border-border rounded-lg outline-none focus:border-ring focus:ring-2 focus:ring-ring/20" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••"
              className="w-full h-10 px-3 text-sm bg-transparent border border-border rounded-lg outline-none focus:border-ring focus:ring-2 focus:ring-ring/20" />
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} className="w-4 h-4 accent-foreground" />
            Keep me logged in for 12 hours
          </label>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <button type="submit" className="w-full h-10 bg-foreground text-background rounded-lg text-sm font-medium hover:opacity-90 transition-opacity">
            Sign in
          </button>
        </form>
        <p className="text-center text-[0.8125rem] text-muted-foreground mt-4">
          Demo: <strong>demo@cardpulse.io</strong> / <strong>demo1234</strong>
        </p>
      </div>
    </div>
  )
}
