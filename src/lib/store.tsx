"use client"

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react"
import type { Account, Transaction } from "@/types"

interface AppState {
  loggedIn: boolean
  userName: string
  userEmail: string
  baseCurrency: string
  onboarded: boolean
  accounts: Account[]
  transactions: Transaction[]
}

const DEFAULT_STATE: AppState = {
  loggedIn: false,
  userName: "",
  userEmail: "",
  baseCurrency: "GBP",
  onboarded: false,
  accounts: [],
  transactions: [],
}

interface StoreContextType extends AppState {
  loginWithSession: (user: { id: number; email: string; name: string }) => Promise<void>
  logout: () => void
  setUserName: (name: string) => void
  setOnboarded: (v: boolean) => void
  setBaseCurrency: (c: string) => void
  refreshAccounts: () => Promise<void>
  refreshTransactions: (accountId?: number) => Promise<void>
  refreshAll: () => Promise<void>
}

const StoreContext = createContext<StoreContextType | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(DEFAULT_STATE)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    async function checkSession() {
      try {
        const res = await fetch("/api/auth/session")
        const data = await res.json()
        if (data.user) {
          const [acctRes, txRes] = await Promise.all([
            fetch("/api/accounts"),
            fetch("/api/transactions?limit=100"),
          ])
          const accounts = acctRes.ok ? await acctRes.json() : []
          const txData = txRes.ok ? await txRes.json() : []

          setState({
            loggedIn: true,
            userName: data.user.name || "",
            userEmail: data.user.email,
            baseCurrency: data.user.baseCurrency || "GBP",
            onboarded: data.user.onboarded ?? false,
            accounts,
            transactions: txData,
          })
        }
      } catch {}
      setHydrated(true)
    }
    checkSession()
  }, [])

  const loginWithSession = useCallback(async (user: { id: number; email: string; name: string }) => {
    try {
      const [acctRes, txRes] = await Promise.all([
        fetch("/api/accounts"),
        fetch("/api/transactions?limit=100"),
      ])
      const accounts = acctRes.ok ? await acctRes.json() : []
      const txData = txRes.ok ? await txRes.json() : []

      setState({
        loggedIn: true,
        userName: user.name || "",
        userEmail: user.email,
        baseCurrency: "GBP",
        onboarded: accounts.length > 0,
        accounts,
        transactions: txData,
      })
    } catch {
      setState((prev) => ({
        ...prev,
        loggedIn: true,
        userName: user.name,
        userEmail: user.email,
      }))
    }
  }, [])

  const logout = useCallback(async () => {
    try { await fetch("/api/auth/logout", { method: "POST" }) } catch {}
    setState(DEFAULT_STATE)
  }, [])

  const setUserName = useCallback((userName: string) => {
    setState((prev) => ({ ...prev, userName }))
    fetch("/api/user", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: userName }),
    }).catch(() => {})
  }, [])

  const setOnboarded = useCallback((onboarded: boolean) => {
    setState((prev) => ({ ...prev, onboarded }))
    fetch("/api/user", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ onboarded }),
    }).catch(() => {})
  }, [])

  const setBaseCurrency = useCallback((baseCurrency: string) => {
    setState((prev) => ({ ...prev, baseCurrency }))
    fetch("/api/user", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ baseCurrency }),
    }).catch(() => {})
  }, [])

  const refreshAccounts = useCallback(async () => {
    try {
      const res = await fetch("/api/accounts")
      if (res.ok) {
        const accounts = await res.json()
        setState((prev) => ({ ...prev, accounts }))
      }
    } catch {}
  }, [])

  const refreshTransactions = useCallback(async (accountId?: number) => {
    try {
      const url = accountId ? `/api/transactions?accountId=${accountId}&limit=200` : "/api/transactions?limit=100"
      const res = await fetch(url)
      if (res.ok) {
        const transactions = await res.json()
        setState((prev) => ({ ...prev, transactions }))
      }
    } catch {}
  }, [])

  const refreshAll = useCallback(async () => {
    await Promise.all([refreshAccounts(), refreshTransactions()])
  }, [refreshAccounts, refreshTransactions])

  if (!hydrated) return null

  return (
    <StoreContext.Provider
      value={{
        ...state,
        loginWithSession, logout, setUserName, setOnboarded, setBaseCurrency,
        refreshAccounts, refreshTransactions, refreshAll,
      }}
    >
      {children}
    </StoreContext.Provider>
  )
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error("useStore must be used within StoreProvider")
  return ctx
}
