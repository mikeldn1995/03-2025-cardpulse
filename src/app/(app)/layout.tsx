"use client"

import { useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import { useStore } from "@/lib/store"
import { BottomNav } from "@/components/bottom-nav"
import { TopNav } from "@/components/top-nav"

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { loggedIn, onboarded } = useStore()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (!loggedIn) {
      router.replace("/login")
    } else if (!onboarded && pathname !== "/onboarding") {
      router.replace("/onboarding")
    }
  }, [loggedIn, onboarded, pathname, router])

  if (!loggedIn) return null

  // Show onboarding without nav chrome
  if (!onboarded || pathname === "/onboarding") {
    return (
      <main className="flex-1 px-4 pb-24 pt-4">
        {children}
      </main>
    )
  }

  return (
    <>
      <TopNav />
      <main className="flex-1 px-4 pb-24 pt-4">
        {children}
      </main>
      <BottomNav />
    </>
  )
}
