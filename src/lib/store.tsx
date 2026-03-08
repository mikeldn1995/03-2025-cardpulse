"use client"

import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from "react"
import { CreditCard, MonthlyRecord, AppState } from "@/types/card"

const DEFAULT_STATE: AppState = {
  loggedIn: false,
  loginExpiry: null,
  userName: "",
  userEmail: "",
  utilThreshold: 75,
  currency: "GBP",
  theme: "system",
  cards: [],
  forecastMonthly: 200,
  onboarded: false,
}

interface StoreContextType extends AppState {
  loginWithSession: (user: { id: number; email: string; name: string }) => Promise<void>
  logout: () => void
  setUserName: (name: string) => void
  setOnboarded: (v: boolean) => void
  addCard: (card: CreditCard) => void
  updateCard: (id: number, updates: Partial<CreditCard>) => void
  deleteCard: (id: number) => void
  setCurrency: (c: AppState["currency"]) => void
  setTheme: (t: AppState["theme"]) => void
  setUtilThreshold: (n: number) => void
  setForecastMonthly: (n: number) => void
  resetCards: () => void
  upsertRecord: (cardId: number, record: MonthlyRecord) => void
  deleteRecord: (cardId: number, month: string) => void
}

const StoreContext = createContext<StoreContextType | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(DEFAULT_STATE)
  const [hydrated, setHydrated] = useState(false)
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const stateRef = useRef(state)
  stateRef.current = state

  // Hydrate: check session cookie via API
  useEffect(() => {
    async function checkSession() {
      try {
        const res = await fetch("/api/auth/session")
        const data = await res.json()
        if (data.user) {
          const stateRes = await fetch("/api/state")
          if (stateRes.ok) {
            const dbState = await stateRes.json()
            setState({
              loggedIn: true,
              loginExpiry: Date.now() + 30 * 24 * 3600000,
              userName: dbState.userName || data.user.name || "",
              userEmail: data.user.email,
              utilThreshold: dbState.utilThreshold ?? 75,
              currency: dbState.currency ?? "GBP",
              theme: (dbState.theme ?? "system") as AppState["theme"],
              cards: dbState.cards || [],
              forecastMonthly: dbState.forecastMonthly ?? 200,
              onboarded: dbState.onboarded ?? false,
            })
          }
        }
      } catch {}
      setHydrated(true)
    }
    checkSession()
  }, [])

  // Debounced sync to API
  const syncToApi = useCallback(() => {
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current)
    syncTimerRef.current = setTimeout(async () => {
      const s = stateRef.current
      if (!s.loggedIn) return
      try {
        await fetch("/api/state", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userName: s.userName,
            currency: s.currency,
            theme: s.theme,
            utilThreshold: s.utilThreshold,
            forecastMonthly: s.forecastMonthly,
            onboarded: s.onboarded,
            cards: s.cards,
          }),
        })
      } catch (e) {
        console.error("Failed to sync state:", e)
      }
    }, 1500)
  }, [])

  // Sync on state changes (after hydration)
  useEffect(() => {
    if (hydrated && state.loggedIn) {
      syncToApi()
    }
  }, [state, hydrated, syncToApi])

  // Theme
  useEffect(() => {
    if (!hydrated) return
    const html = document.documentElement
    html.classList.remove("dark", "light")
    if (state.theme === "dark") html.classList.add("dark")
    else if (state.theme === "light") html.classList.remove("dark")
    else if (window.matchMedia("(prefers-color-scheme: dark)").matches) html.classList.add("dark")
  }, [state.theme, hydrated])

  const loginWithSession = useCallback(async (user: { id: number; email: string; name: string }) => {
    try {
      const stateRes = await fetch("/api/state")
      if (stateRes.ok) {
        const dbState = await stateRes.json()
        setState({
          loggedIn: true,
          loginExpiry: Date.now() + 30 * 24 * 3600000,
          userName: user.name || dbState.userName || "",
          userEmail: user.email,
          utilThreshold: dbState.utilThreshold ?? 75,
          currency: dbState.currency ?? "GBP",
          theme: (dbState.theme ?? "system") as AppState["theme"],
          cards: dbState.cards || [],
          forecastMonthly: dbState.forecastMonthly ?? 200,
          onboarded: dbState.onboarded ?? false,
        })
        return
      }
    } catch {}
    setState(prev => ({
      ...prev,
      loggedIn: true,
      loginExpiry: Date.now() + 30 * 24 * 3600000,
      userName: user.name,
      userEmail: user.email,
    }))
  }, [])

  const setUserName = useCallback((userName: string) => {
    setState(prev => ({ ...prev, userName }))
  }, [])

  const setOnboarded = useCallback((onboarded: boolean) => {
    setState(prev => ({ ...prev, onboarded }))
  }, [])

  const logout = useCallback(async () => {
    try { await fetch("/api/auth/logout", { method: "POST" }) } catch {}
    setState(DEFAULT_STATE)
  }, [])

  const addCard = useCallback((card: CreditCard) => {
    setState(prev => ({ ...prev, cards: [...prev.cards, card] }))
  }, [])

  const updateCard = useCallback((id: number, updates: Partial<CreditCard>) => {
    setState(prev => ({
      ...prev,
      cards: prev.cards.map(c => c.id === id ? { ...c, ...updates } : c),
    }))
  }, [])

  const deleteCard = useCallback((id: number) => {
    setState(prev => ({ ...prev, cards: prev.cards.filter(c => c.id !== id) }))
  }, [])

  const setCurrency = useCallback((currency: AppState["currency"]) => {
    setState(prev => ({ ...prev, currency }))
  }, [])

  const setTheme = useCallback((theme: AppState["theme"]) => {
    setState(prev => ({ ...prev, theme }))
  }, [])

  const setUtilThreshold = useCallback((utilThreshold: number) => {
    setState(prev => ({ ...prev, utilThreshold }))
  }, [])

  const setForecastMonthly = useCallback((forecastMonthly: number) => {
    setState(prev => ({ ...prev, forecastMonthly }))
  }, [])

  const resetCards = useCallback(() => {
    setState(prev => ({ ...prev, cards: [] }))
  }, [])

  const upsertRecord = useCallback((cardId: number, record: MonthlyRecord) => {
    setState(prev => ({
      ...prev,
      cards: prev.cards.map(c => {
        if (c.id !== cardId) return c
        const existing = c.monthlyRecords.findIndex(r => r.month === record.month)
        const records = [...c.monthlyRecords]
        if (existing >= 0) records[existing] = record
        else records.push(record)
        records.sort((a, b) => a.month.localeCompare(b.month))
        return { ...c, monthlyRecords: records }
      }),
    }))
  }, [])

  const deleteRecord = useCallback((cardId: number, month: string) => {
    setState(prev => ({
      ...prev,
      cards: prev.cards.map(c => {
        if (c.id !== cardId) return c
        return { ...c, monthlyRecords: c.monthlyRecords.filter(r => r.month !== month) }
      }),
    }))
  }, [])

  if (!hydrated) return null

  return (
    <StoreContext.Provider value={{
      ...state, loginWithSession, logout, setUserName, setOnboarded,
      addCard, updateCard, deleteCard,
      setCurrency, setTheme, setUtilThreshold, setForecastMonthly, resetCards,
      upsertRecord, deleteRecord,
    }}>
      {children}
    </StoreContext.Provider>
  )
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error("useStore must be used within StoreProvider")
  return ctx
}
