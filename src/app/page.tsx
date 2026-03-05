"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useStore } from "@/lib/store"
import { ArrowRight, CreditCard, TrendingDown, BarChart3, Shield } from "lucide-react"

export default function LandingPage() {
  const { loggedIn } = useStore()
  const router = useRouter()

  useEffect(() => {
    if (loggedIn) router.replace("/dashboard")
  }, [loggedIn, router])

  if (loggedIn) return null

  return (
    <div className="flex flex-col min-h-dvh">
      {/* Header */}
      <header className="px-4 h-14 flex items-center justify-between border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-foreground text-background rounded-lg inline-flex items-center justify-center text-xs font-bold">
            CP
          </div>
          <span className="text-sm font-semibold tracking-tight">CardPulse</span>
        </div>
        <button
          onClick={() => router.push("/login")}
          className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          Sign in
        </button>
      </header>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center px-6 py-12 text-center">
        <div className="w-16 h-16 bg-foreground text-background rounded-2xl inline-flex items-center justify-center text-2xl font-bold mb-6">
          CP
        </div>
        <h1 className="text-3xl font-bold tracking-tight leading-tight mb-3">
          Take control of<br />your credit cards
        </h1>
        <p className="text-sm text-muted-foreground max-w-[280px] mb-8">
          Track balances, forecast payoff dates, and reduce interest — all from one dashboard.
        </p>
        <div className="flex flex-col gap-3 w-full max-w-[280px]">
          <button
            onClick={() => router.push("/register")}
            className="h-11 bg-foreground text-background rounded-lg text-sm font-medium hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
          >
            Get Started
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => router.push("/login")}
            className="h-11 bg-secondary text-foreground rounded-lg text-sm font-medium hover:bg-accent transition-colors"
          >
            Sign in to existing account
          </button>
        </div>
      </section>

      {/* Features */}
      <section className="px-6 pb-12 space-y-4">
        <Feature
          icon={CreditCard}
          title="All cards, one view"
          desc="See every balance, limit, and payment date at a glance."
        />
        <Feature
          icon={TrendingDown}
          title="Payoff forecasting"
          desc="Visualise when you'll be debt-free with your repayment plan."
        />
        <Feature
          icon={BarChart3}
          title="Interest tracking"
          desc="Know exactly how much interest you're paying each month."
        />
        <Feature
          icon={Shield}
          title="Stay on top of payments"
          desc="Due date reminders and utilization alerts keep you informed."
        />
      </section>

      {/* Footer */}
      <footer className="px-6 py-6 border-t border-border text-center">
        <p className="text-[0.6875rem] text-muted-foreground/60">
          CardPulse v0.1.0 — Demo Build
        </p>
      </footer>
    </div>
  )
}

function Feature({ icon: Icon, title, desc }: { icon: typeof CreditCard; title: string; desc: string }) {
  return (
    <div className="flex gap-3 bg-card border border-border rounded-lg p-4">
      <div className="w-10 h-10 bg-foreground/5 rounded-lg flex items-center justify-center shrink-0">
        <Icon className="w-5 h-5 text-foreground/70" />
      </div>
      <div>
        <div className="text-sm font-semibold mb-0.5">{title}</div>
        <div className="text-xs text-muted-foreground">{desc}</div>
      </div>
    </div>
  )
}
