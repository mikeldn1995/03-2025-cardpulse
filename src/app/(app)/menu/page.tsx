"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useStore } from "@/lib/store"
import {
  TrendingUp,
  Lightbulb,
  Settings,
  Info,
  ChevronRight,
  LogOut,
  FileText,
} from "lucide-react"
import { Logo } from "@/components/logo"

const MENU_ITEMS = [
  { href: "/forecast",  label: "Forecast",       description: "Payoff projections",    icon: TrendingUp },
  { href: "/insights",  label: "Insights",       description: "Spending analysis",     icon: Lightbulb },
  { href: "/digest",    label: "Monthly Digest", description: "Printable PDF report",  icon: FileText },
  { href: "/settings",  label: "Settings",       description: "Preferences & data",    icon: Settings },
  { href: "/about",     label: "About",          description: "App info & support",    icon: Info },
]

export default function MenuPage() {
  const { userName, userEmail, logout } = useStore()
  const router = useRouter()

  const handleLogout = () => {
    logout()
    router.replace("/login")
  }

  return (
    <div className="flex flex-col gap-6 pt-2">
      {/* User profile header */}
      <div className="flex items-center gap-4 px-1">
        <div className="w-14 h-14 rounded-full bg-[hsl(217,70%,50%)] flex items-center justify-center text-white font-bold text-lg">
          {userName
            ? userName
                .split(/\s+/)
                .slice(0, 2)
                .map((w) => w[0])
                .join("")
                .toUpperCase()
            : "?"}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold text-base truncate">
            {userName || "User"}
          </p>
          <p className="text-white/50 text-sm truncate">{userEmail}</p>
        </div>
      </div>

      {/* Menu items */}
      <div className="bg-[#1B2A4A] rounded-2xl overflow-hidden">
        {MENU_ITEMS.map((item, i) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-4 px-4 py-4 active:bg-white/5 transition-colors"
          >
            <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
              <item.icon className="w-5 h-5 text-[hsl(217,70%,50%)]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-medium">{item.label}</p>
              <p className="text-white/40 text-xs">{item.description}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-white/20 shrink-0" />
            {i < MENU_ITEMS.length - 1 && (
              <div className="absolute left-[4.5rem] right-4 bottom-0 h-px bg-white/5" />
            )}
          </Link>
        ))}
      </div>

      {/* Logout */}
      <button
        onClick={handleLogout}
        className="bg-[#1B2A4A] rounded-2xl flex items-center gap-4 px-4 py-4 active:bg-white/5 transition-colors w-full"
      >
        <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0">
          <LogOut className="w-5 h-5 text-red-400" />
        </div>
        <span className="text-red-400 text-sm font-medium">Sign Out</span>
      </button>

      {/* App branding */}
      <div className="flex flex-col items-center gap-2 pt-4 pb-8">
        <Logo size={24} variant="dark" />
        <p className="text-white/20 text-xs">CardPulse v4.0</p>
      </div>
    </div>
  )
}
