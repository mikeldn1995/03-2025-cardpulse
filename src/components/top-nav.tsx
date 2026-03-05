"use client"

import { usePathname } from "next/navigation"

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/cards": "My Cards",
  "/forecast": "Forecast",
  "/upload": "Upload",
  "/settings": "Settings",
}

export function TopNav() {
  const pathname = usePathname()
  const title = Object.entries(PAGE_TITLES).find(([path]) => pathname.startsWith(path))?.[1] || "CardPulse"

  return (
    <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border px-4 h-12 flex items-center gap-2.5">
      <div className="w-7 h-7 bg-foreground text-background rounded-md inline-flex items-center justify-center text-[0.6875rem] font-bold shrink-0">
        CP
      </div>
      <span className="text-sm font-semibold tracking-tight">{title}</span>
    </header>
  )
}
