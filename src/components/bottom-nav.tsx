"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  ArrowLeftRight,
  Upload,
  Wallet,
  Menu,
} from "lucide-react"
import { cn } from "@/lib/utils"

const NAV_ITEMS = [
  { href: "/dashboard",    label: "Dashboard",    icon: LayoutDashboard },
  { href: "/transactions", label: "Transactions", icon: ArrowLeftRight },
  { href: "/upload",       label: "Upload",       icon: Upload, center: true },
  { href: "/accounts",     label: "Accounts",     icon: Wallet },
  { href: "/menu",         label: "Menu",         icon: Menu },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav
      data-bottom-nav
      className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] bg-white border-t border-border flex z-50 pb-[env(safe-area-inset-bottom)]"
    >
      {NAV_ITEMS.map((item) => {
        const active = pathname.startsWith(item.href)

        if (item.center) {
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex-1 flex flex-col items-center justify-center py-2 gap-1"
            >
              <div
                className={cn(
                  "w-11 h-11 -mt-5 rounded-full flex items-center justify-center shadow-lg",
                  active
                    ? "bg-[#1B2A4A]"
                    : "bg-[#1B2A4A]/90"
                )}
              >
                <item.icon className="w-5 h-5 text-white" />
              </div>
              <span
                className={cn(
                  "text-[0.6rem] font-medium tracking-wide",
                  active ? "text-[#1B2A4A]" : "text-muted-foreground"
                )}
              >
                {item.label}
              </span>
            </Link>
          )
        }

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex-1 flex flex-col items-center justify-center py-2.5 gap-1 transition-colors",
            )}
          >
            <item.icon
              className={cn(
                "w-5 h-5",
                active ? "text-[#1B2A4A]" : "text-muted-foreground"
              )}
            />
            <span
              className={cn(
                "text-[0.6rem] font-medium tracking-wide",
                active ? "text-[#1B2A4A]" : "text-muted-foreground"
              )}
            >
              {item.label}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
