"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { User, ChevronRight, Download, FileText, Trash2, Info, LogOut } from "lucide-react"
import { useStore } from "@/lib/store"
import { Logo } from "@/components/logo"
import { useToast } from "@/components/toast"

const CURRENCIES = [
  { code: "GBP", label: "GBP", symbol: "\u00a3" },
  { code: "USD", label: "USD", symbol: "$" },
  { code: "EUR", label: "EUR", symbol: "\u20ac" },
  { code: "PLN", label: "PLN", symbol: "z\u0142" },
  { code: "CHF", label: "CHF", symbol: "Fr" },
  { code: "CAD", label: "CAD", symbol: "C$" },
  { code: "AUD", label: "AUD", symbol: "A$" },
  { code: "JPY", label: "JPY", symbol: "\u00a5" },
  { code: "SEK", label: "SEK", symbol: "kr" },
  { code: "NOK", label: "NOK", symbol: "kr" },
]

export default function SettingsPage() {
  const { userName, userEmail, baseCurrency, setUserName, setBaseCurrency, logout } = useStore()
  const { toast } = useToast()
  const router = useRouter()

  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState(userName)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmDeleteFinal, setConfirmDeleteFinal] = useState(false)
  const [confirmLogout, setConfirmLogout] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const handleSaveName = () => {
    const trimmed = nameInput.trim()
    if (trimmed) {
      setUserName(trimmed)
      toast("Name updated")
    }
    setEditingName(false)
  }

  const handleDeleteAllData = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    if (!confirmDeleteFinal) {
      setConfirmDeleteFinal(true)
      return
    }
    setDeleting(true)
    try {
      await fetch("/api/accounts", { method: "DELETE" })
      toast("All data deleted")
    } catch {
      toast("Failed to delete data")
    } finally {
      setDeleting(false)
      setConfirmDelete(false)
      setConfirmDeleteFinal(false)
    }
  }

  const handleLogout = () => {
    if (!confirmLogout) {
      setConfirmLogout(true)
      return
    }
    logout()
    router.push("/login")
  }

  return (
    <div className="min-h-dvh bg-[#0A1628]">
      <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
        <div className="pb-1">
          <h1 className="text-lg font-semibold text-white">Settings</h1>
          <p className="text-sm text-slate-400">Preferences and account</p>
        </div>

        {/* Profile */}
        <Section title="Profile">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-blue-500/20 flex items-center justify-center">
              <User className="w-5 h-5 text-blue-400" />
            </div>
            <div className="flex-1 min-w-0">
              {editingName ? (
                <form
                  className="flex items-center gap-2"
                  onSubmit={(e) => {
                    e.preventDefault()
                    handleSaveName()
                  }}
                >
                  <input
                    type="text"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    autoFocus
                    className="h-8 flex-1 px-2.5 text-sm bg-[#0A1628] border border-slate-600 rounded-md text-white outline-none focus:border-blue-500"
                  />
                  <button type="submit" className="text-xs font-medium text-blue-400 hover:text-blue-300">
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingName(false)
                      setNameInput(userName)
                    }}
                    className="text-xs text-slate-500 hover:text-slate-400"
                  >
                    Cancel
                  </button>
                </form>
              ) : (
                <div
                  className="text-sm font-medium text-white cursor-pointer hover:text-blue-300 transition-colors"
                  onClick={() => {
                    setNameInput(userName)
                    setEditingName(true)
                  }}
                >
                  {userName || "Set your name"}
                </div>
              )}
              <div className="text-xs text-slate-500 mt-0.5">{userEmail || "demo@cardpulse.io"}</div>
            </div>
          </div>
        </Section>

        {/* Preferences */}
        <Section title="Preferences">
          <div>
            <label className="block text-xs text-slate-400 mb-2">Base Currency</label>
            <div className="grid grid-cols-5 gap-1.5">
              {CURRENCIES.map((c) => (
                <button
                  key={c.code}
                  onClick={() => {
                    setBaseCurrency(c.code)
                    toast(`Currency set to ${c.code}`)
                  }}
                  className={`py-2 text-xs font-medium rounded-md transition-colors ${
                    baseCurrency === c.code
                      ? "bg-blue-500 text-white"
                      : "bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-700"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
        </Section>

        {/* Data Management */}
        <Section title="Data Management">
          <div className="space-y-2">
            <button
              disabled
              className="w-full flex items-center gap-3 py-3 px-3 text-sm text-slate-400 bg-slate-800/50 rounded-md opacity-60 cursor-not-allowed"
            >
              <Download className="w-4 h-4" />
              <div className="flex-1 text-left">
                <div className="font-medium">Export Data</div>
                <div className="text-[0.6875rem] text-slate-500">CSV/JSON export — coming soon</div>
              </div>
            </button>

            <button
              disabled
              className="w-full flex items-center gap-3 py-3 px-3 text-sm text-slate-400 bg-slate-800/50 rounded-md opacity-60 cursor-not-allowed"
            >
              <FileText className="w-4 h-4" />
              <div className="flex-1 text-left">
                <div className="font-medium">Generate Monthly Digest</div>
                <div className="text-[0.6875rem] text-slate-500">AI summary — coming soon</div>
              </div>
            </button>

            <div className="pt-2">
              <button
                onClick={handleDeleteAllData}
                disabled={deleting}
                className={`w-full flex items-center justify-center gap-2 py-3 text-sm font-medium rounded-md transition-colors ${
                  confirmDeleteFinal
                    ? "bg-red-600 text-white"
                    : confirmDelete
                      ? "bg-red-500/20 text-red-400 border border-red-500/30"
                      : "bg-slate-800/80 text-red-400 hover:bg-red-500/10"
                }`}
              >
                <Trash2 className="w-4 h-4" />
                {deleting
                  ? "Deleting..."
                  : confirmDeleteFinal
                    ? "Are you sure? This cannot be undone."
                    : confirmDelete
                      ? "Tap again to confirm deletion"
                      : "Delete All Data"}
              </button>
              {(confirmDelete || confirmDeleteFinal) && (
                <button
                  onClick={() => {
                    setConfirmDelete(false)
                    setConfirmDeleteFinal(false)
                  }}
                  className="w-full text-xs text-slate-500 underline mt-1.5 py-1"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        </Section>

        {/* App Info */}
        <Section title="App Info">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Logo size={28} variant="dark" />
              <div>
                <div className="text-sm font-medium text-white">CardPulse</div>
                <div className="text-xs text-slate-500">v4.0.0 &quot;Aggregate&quot;</div>
              </div>
            </div>
            <Link
              href="/about"
              className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
            >
              <Info className="w-3.5 h-3.5" />
              About
              <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
        </Section>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className={`w-full flex items-center justify-center gap-2 py-3 text-sm font-medium rounded-lg transition-colors ${
            confirmLogout
              ? "bg-red-600 text-white"
              : "bg-[#111D32] border border-slate-700/50 text-red-400 hover:bg-red-500/10"
          }`}
        >
          <LogOut className="w-4 h-4" />
          {confirmLogout ? "Tap again to log out" : "Log Out"}
        </button>
        {confirmLogout && (
          <button
            onClick={() => setConfirmLogout(false)}
            className="w-full text-xs text-slate-500 underline text-center"
          >
            Cancel
          </button>
        )}

        {/* Footer */}
        <div className="text-center text-[0.625rem] text-slate-600 pt-2 pb-20">
          CardPulse v4.0.0
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-[#111D32] border border-slate-700/50 rounded-xl p-4">
      <div className="text-[0.6875rem] uppercase tracking-wider text-slate-500 font-medium mb-3">
        {title}
      </div>
      {children}
    </div>
  )
}
