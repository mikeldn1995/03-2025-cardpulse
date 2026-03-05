"use client"

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react"
import { CreditCard, AppState } from "@/types/card"
import { SEED_CARDS } from "@/lib/seed-data"

const DEFAULT_STATE: AppState = {
  loggedIn: false,
  loginExpiry: null,
  utilThreshold: 50,
  currency: "GBP",
  theme: "system",
  cards: structuredClone(SEED_CARDS),
  forecastMonthly: 1500,
}

interface StoreContextType extends AppState {
  login: (email: string, password: string, remember: boolean) => boolean
  logout: () => void
  updateCard: (id: number, updates: Partial<CreditCard>) => void
  deleteCard: (id: number) => void
  setCurrency: (c: AppState["currency"]) => void
  setTheme: (t: AppState["theme"]) => void
  setUtilThreshold: (n: number) => void
  setForecastMonthly: (n: number) => void
  resetCards: () => void
}

const StoreContext = createContext<StoreContextType | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(DEFAULT_STATE)
  const [hydrated, setHydrated] = useState(false)

  // Hydrate from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem("cp_state")
      if (raw) {
        const parsed: AppState = JSON.parse(raw)
        if (parsed.loginExpiry && Date.now() < parsed.loginExpiry) {
          setState(parsed)
        } else {
          localStorage.removeItem("cp_state")
        }
      }
    } catch {}
    setHydrated(true)
  }, [])

  // Persist
  useEffect(() => {
    if (hydrated) {
      try { localStorage.setItem("cp_state", JSON.stringify(state)) } catch {}
    }
  }, [state, hydrated])

  // Theme
  useEffect(() => {
    if (!hydrated) return
    const html = document.documentElement
    html.classList.remove("dark", "light")
    if (state.theme === "dark") html.classList.add("dark")
    else if (state.theme === "light") html.classList.remove("dark")
    else if (window.matchMedia("(prefers-color-scheme: dark)").matches) html.classList.add("dark")
  }, [state.theme, hydrated])

  const login = useCallback((email: string, password: string, remember: boolean): boolean => {
    if (email === "demo@cardpulse.io" && password === "demo1234") {
      setState(prev => ({
        ...prev,
        loggedIn: true,
        loginExpiry: remember ? Date.now() + 12 * 3600000 : Date.now() + 1800000,
      }))
      return true
    }
    return false
  }, [])

  const logout = useCallback(() => {
    setState({ ...DEFAULT_STATE, cards: structuredClone(SEED_CARDS) })
    localStorage.removeItem("cp_state")
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
    setState(prev => ({ ...prev, cards: structuredClone(SEED_CARDS) }))
  }, [])

  if (!hydrated) return null

  return (
    <StoreContext.Provider value={{
      ...state, login, logout, updateCard, deleteCard,
      setCurrency, setTheme, setUtilThreshold, setForecastMonthly, resetCards,
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
