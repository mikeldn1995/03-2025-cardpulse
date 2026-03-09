import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { StoreProvider } from "@/lib/store"
import { ToastProvider } from "@/components/toast"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "CardPulse — Financial Aggregator",
  description: "Aggregate and track all your financial accounts in one place.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "CardPulse",
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#ffffff",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} min-h-dvh bg-[#FCFCFC] text-[#1B2A4A] antialiased`}>
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
