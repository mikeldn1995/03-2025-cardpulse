"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useStore } from "@/lib/store"
import { BottomNav } from "@/components/bottom-nav"

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { loggedIn } = useStore()
  const router = useRouter()

  useEffect(() => {
    if (!loggedIn) router.replace("/login")
  }, [loggedIn, router])

  if (!loggedIn) return null

  return (
    <>
      <main className="flex-1 px-4 pb-24 pt-4">
        {children}
      </main>
      <BottomNav />
    </>
  )
}
