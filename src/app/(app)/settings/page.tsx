"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { LogOut, RotateCcw, Moon, Sun, Monitor } from "lucide-react"
import { useStore } from "@/lib/store"
import { useToast } from "@/components/toast"
import { cn } from "@/lib/utils"

export default function SettingsPage() {
  const {
    currency, theme, utilThreshold,
    setCurrency, setTheme, setUtilThreshold,
    resetCards, logout, cards,
  } = useStore()
  const { toast } = useToast()
  const router = useRouter()
  const [confirmReset, setConfirmReset] = useState(false)
  const [confirmLogout, setConfirmLogout] = useState(false)

  const handleLogout = () => {
    if (!confirmLogout) { setConfirmLogout(true); return }
    logout()
    router.push("/login")
  }

  const handleReset = () => {
    if (!confirmReset) { setConfirmReset(true); return }
    resetCards()
    setConfirmReset(false)
    toast("Cards reset to demo data")
  }

  return (
    <>
      <div className="pb-4">
        <h2 className="text-xl font-semibold tracking-tight">Settings</h2>
        <p className="text-[0.8125rem] text-muted-foreground mt-0.5">Preferences and account</p>
      </div>

      <div className="space-y-3">
        {/* Profile */}
        <Section title="Profile">
          <div className="flex items-center gap-3 py-1">
            <div className="w-10 h-10 rounded-full bg-foreground/10 flex items-center justify-center text-sm font-semibold">
              D
            </div>
            <div>
              <div className="text-sm font-medium">demo@cardpulse.io</div>
              <div className="text-xs text-muted-foreground">{cards.length} card{cards.length !== 1 ? "s" : ""} linked</div>
            </div>
          </div>
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

        {/* Notifications */}
        <Section title="Notifications">
          <div className="space-y-2">
            <ToggleRow label="Payment reminders" defaultOn />
            <ToggleRow label="Utilization alerts" defaultOn />
            <ToggleRow label="Weekly summary email" defaultOn={false} />
          </div>
          <div className="text-[0.6875rem] text-muted-foreground/80 italic mt-2">
            Demo mode — notifications are simulated
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
            {confirmReset ? "Tap again to confirm reset" : "Reset to demo data"}
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
          CardPulse v0.1.0 — Demo Build
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

function ToggleRow({ label, defaultOn }: { label: string; defaultOn: boolean }) {
  const [on, setOn] = useState(defaultOn)
  return (
    <div className="flex items-center justify-between cursor-pointer" onClick={() => setOn(!on)}>
      <span className="text-sm">{label}</span>
      <div
        className={cn(
          "w-9 h-5 rounded-full relative transition-colors",
          on ? "bg-foreground" : "bg-border"
        )}
      >
        <span className={cn(
          "absolute top-0.5 w-4 h-4 rounded-full bg-background transition-transform",
          on ? "left-[18px]" : "left-0.5"
        )} />
      </div>
    </div>
  )
}
