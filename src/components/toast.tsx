"use client"

import { createContext, useContext, useState, useCallback, ReactNode } from "react"
import { cn } from "@/lib/utils"

interface ToastCtx { toast: (msg: string) => void }
const ToastContext = createContext<ToastCtx>({ toast: () => {} })
export const useToast = () => useContext(ToastContext)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState("")
  const [visible, setVisible] = useState(false)

  const toast = useCallback((msg: string) => {
    setMessage(msg)
    setVisible(true)
    setTimeout(() => setVisible(false), 2200)
  }, [])

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className={cn(
        "fixed bottom-20 left-1/2 -translate-x-1/2 bg-foreground text-background text-sm font-medium px-4 py-2.5 rounded-lg z-[100] whitespace-nowrap transition-all duration-300",
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2 pointer-events-none"
      )}>
        {message}
      </div>
    </ToastContext.Provider>
  )
}
