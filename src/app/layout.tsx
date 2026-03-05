import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { StoreProvider } from "@/lib/store"
import { ToastProvider } from "@/components/toast"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "CardPulse — Credit Card Tracker",
  description: "Track your credit cards, stay in control.",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} min-h-dvh bg-background text-foreground antialiased`}>
        <StoreProvider>
          <ToastProvider>
            <div className="max-w-[430px] mx-auto min-h-dvh relative flex flex-col">
              {children}
            </div>
          </ToastProvider>
        </StoreProvider>
      </body>
    </html>
  )
}
