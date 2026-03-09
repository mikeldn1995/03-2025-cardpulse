"use client"

import { useStore } from "@/lib/store"
import { Logo } from "@/components/logo"
import { getGreeting } from "@/lib/utils"

export function TopNav() {
  const { userName } = useStore()
  const greeting = getGreeting(userName || "there")

  return (
    <header className="sticky top-0 z-40 bg-[#0A1628] px-4 h-14 flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        <Logo size={28} variant="dark" />
        <span className="text-sm font-bold tracking-tight text-white">
          CardPulse
        </span>
      </div>
      <span className="text-xs text-white/60 truncate max-w-[180px]">
        {greeting}
      </span>
    </header>
  )
}
