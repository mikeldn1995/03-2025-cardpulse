"use client"

import { usePathname, useRouter } from "next/navigation"
import { LayoutGrid, CreditCard, BarChart3, Upload, Settings } from "lucide-react"
import { cn } from "@/lib/utils"

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutGrid },
  { href: "/cards",     label: "Cards",     icon: CreditCard },
  { href: "/forecast",  label: "Forecast",  icon: BarChart3 },
  { href: "/upload",    label: "Upload",    icon: Upload },
  { href: "/settings",  label: "Settings",  icon: Settings },
]

export function BottomNav() {
  const pathname = usePathname()
  const router = useRouter()

  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] bg-background/80 backdrop-blur-xl border-t border-border flex z-50 pb-[env(safe-area-inset-bottom)]">
      {NAV_ITEMS.map(item => {
        const active = pathname.startsWith(item.href)
        return (
          <button
            key={item.href}
            onClick={() => router.push(item.href)}
            className={cn(
              "flex-1 flex flex-col items-center justify-center py-2.5 gap-1 text-[0.625rem] font-medium uppercase tracking-wider transition-colors",
              active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <item.icon className="w-5 h-5" />
            {item.label}
          </button>
        )
      })}
    </nav>
  )
}
