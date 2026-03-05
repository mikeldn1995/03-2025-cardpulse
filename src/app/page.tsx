"use client"
import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useStore } from "@/lib/store"

export default function Home() {
  const { loggedIn } = useStore()
  const router = useRouter()
  useEffect(() => {
    router.replace(loggedIn ? "/dashboard" : "/login")
  }, [loggedIn, router])
  return null
}
