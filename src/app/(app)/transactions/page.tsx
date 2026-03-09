"use client"

import { useState, useMemo, useCallback, useEffect, useRef } from "react"
import {
  Plus,
  Search,
  Filter,
  ArrowUpRight,
  ArrowDownLeft,
  X,
  Check,
  Loader2,
} from "lucide-react"
import { useStore } from "@/lib/store"
import {
  formatCurrency,
  formatDateShort,
  getLogoUrl,
  getInitials,
  getInstitutionColor,
} from "@/lib/utils"
import type { Account, Transaction } from "@/types"
import { TRANSACTION_CATEGORIES } from "@/types"

// ── Category colours ────────────────────────────────────────
const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  Groceries: { bg: "rgba(34,197,94,0.18)", text: "#4ADE80" },
  Dining: { bg: "rgba(251,146,60,0.18)", text: "#FB923C" },
  Transport: { bg: "rgba(96,165,250,0.18)", text: "#60A5FA" },
  Entertainment: { bg: "rgba(192,132,252,0.18)", text: "#C084FC" },
  Shopping: { bg: "rgba(244,114,182,0.18)", text: "#F472B6" },
  "Bills & Utilities": { bg: "rgba(148,163,184,0.18)", text: "#94A3B8" },
  Health: { bg: "rgba(45,212,191,0.18)", text: "#2DD4BF" },
  Travel: { bg: "rgba(56,189,248,0.18)", text: "#38BDF8" },
  Education: { bg: "rgba(129,140,248,0.18)", text: "#818CF8" },
  Subscriptions: { bg: "rgba(167,139,250,0.18)", text: "#A78BFA" },
  Cash: { bg: "rgba(253,224,71,0.18)", text: "#FDE047" },
  Transfer: { bg: "rgba(148,163,184,0.18)", text: "#94A3B8" },
  Income: { bg: "rgba(34,197,94,0.18)", text: "#4ADE80" },
  Interest: { bg: "rgba(251,191,36,0.18)", text: "#FBBF24" },
  Fees: { bg: "rgba(239,68,68,0.18)", text: "#EF4444" },
  Insurance: { bg: "rgba(100,116,139,0.18)", text: "#CBD5E1" },
  Investments: { bg: "rgba(52,211,153,0.18)", text: "#34D399" },
  Charity: { bg: "rgba(236,72,153,0.18)", text: "#EC4899" },
  "Personal Care": { bg: "rgba(249,115,22,0.18)", text: "#F97316" },
  Home: { bg: "rgba(168,162,158,0.18)", text: "#A8A29E" },
  Uncategorised: { bg: "rgba(100,116,139,0.15)", text: "#64748B" },
}

function getCategoryColor(cat: string) {
  return CATEGORY_COLORS[cat] || CATEGORY_COLORS.Uncategorised
}

// ── Date range helpers ──────────────────────────────────────
type DatePreset = "this-month" | "last-month" | "3-months" | "custom"

function getDateRange(preset: DatePreset): { from: string; to: string } | null {
  const now = new Date()
  if (preset === "this-month") {
    const from = new Date(now.getFullYear(), now.getMonth(), 1)
    return { from: fmt(from), to: fmt(now) }
  }
  if (preset === "last-month") {
    const from = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const to = new Date(now.getFullYear(), now.getMonth(), 0)
    return { from: fmt(from), to: fmt(to) }
  }
  if (preset === "3-months") {
    const from = new Date(now.getFullYear(), now.getMonth() - 2, 1)
    return { from: fmt(from), to: fmt(now) }
  }
  return null
}

function fmt(d: Date) {
  return d.toISOString().slice(0, 10)
}

function dayLabel(dateStr: string): string {
  const today = new Date()
  const d = new Date(dateStr + "T00:00:00")
  const todayStr = fmt(today)
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = fmt(yesterday)

  if (dateStr === todayStr) return "Today"
  if (dateStr === yesterdayStr) return "Yesterday"
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

// ── Main Page ───────────────────────────────────────────────
export default function TransactionsPage() {
  const { accounts, transactions: storeTx, refreshTransactions } = useStore()

  // Filters
  const [accountFilter, setAccountFilter] = useState<number | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const [datePreset, setDatePreset] = useState<DatePreset>("3-months")

  // Fetched transactions (from API with filters)
  const [txList, setTxList] = useState<Transaction[]>(storeTx)
  const [loading, setLoading] = useState(false)

  // Dropdowns
  const [showAccountDD, setShowAccountDD] = useState(false)
  const [showCategoryDD, setShowCategoryDD] = useState(false)

  // Add form
  const [showAddForm, setShowAddForm] = useState(false)

  // Edit mode
  const [editingId, setEditingId] = useState<number | null>(null)

  // Search
  const [searchQuery, setSearchQuery] = useState("")
  const [showSearch, setShowSearch] = useState(false)

  // Fetch transactions when filters change
  const fetchTransactions = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set("limit", "500")
      if (accountFilter) params.set("accountId", String(accountFilter))
      if (categoryFilter) params.set("category", categoryFilter)
      const range = getDateRange(datePreset)
      if (range) {
        params.set("dateFrom", range.from)
        params.set("dateTo", range.to)
      }
      const res = await fetch(`/api/transactions?${params}`)
      if (res.ok) {
        const data = await res.json()
        setTxList(data)
      }
    } catch {
      // fall back to store
      setTxList(storeTx)
    }
    setLoading(false)
  }, [accountFilter, categoryFilter, datePreset, storeTx])

  useEffect(() => {
    fetchTransactions()
  }, [fetchTransactions])

  // Build account lookup
  const accountMap = useMemo(() => {
    const m: Record<number, Account> = {}
    for (const a of accounts) m[a.id] = a
    return m
  }, [accounts])

  // Filter by search
  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return txList
    const q = searchQuery.toLowerCase()
    return txList.filter(
      (tx) =>
        tx.description.toLowerCase().includes(q) ||
        tx.category.toLowerCase().includes(q)
    )
  }, [txList, searchQuery])

  // Group by day
  const grouped = useMemo(() => {
    const groups: { date: string; label: string; txs: Transaction[] }[] = []
    const map = new Map<string, Transaction[]>()
    for (const tx of filtered) {
      const d = tx.date.slice(0, 10)
      if (!map.has(d)) map.set(d, [])
      map.get(d)!.push(tx)
    }
    Array.from(map.entries()).forEach(([date, txs]) => {
      groups.push({ date, label: dayLabel(date), txs })
    })
    // Already sorted newest-first from API, but ensure groups are too
    groups.sort((a, b) => (a.date > b.date ? -1 : 1))
    return groups
  }, [filtered])

  const needsReviewCount = useMemo(
    () => txList.filter((t) => t.needsReview).length,
    [txList]
  )

  return (
    <div className="pb-24">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-bold text-white">Transactions</h1>
        <div className="flex items-center gap-2">
          {needsReviewCount > 0 && (
            <span
              className="rounded-full px-2.5 py-0.5 text-[0.6875rem] font-semibold"
              style={{ backgroundColor: "rgba(245,158,11,0.2)", color: "#FBBF24" }}
            >
              {needsReviewCount} to review
            </span>
          )}
          <button
            onClick={() => setShowSearch((v) => !v)}
            className="flex h-8 w-8 items-center justify-center rounded-full"
            style={{ backgroundColor: "rgba(255,255,255,0.08)" }}
          >
            <Search className="h-4 w-4 text-slate-300" />
          </button>
        </div>
      </div>

      {/* Search bar */}
      {showSearch && (
        <div className="mb-4 relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search transactions..."
            autoFocus
            className="w-full rounded-xl py-2.5 pl-10 pr-10 text-sm text-white placeholder-slate-500 outline-none"
            style={{ backgroundColor: "#1B2A4A" }}
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2"
            >
              <X className="h-4 w-4 text-slate-500" />
            </button>
          )}
        </div>
      )}

      {/* Filter Bar */}
      <div className="flex gap-2 overflow-x-auto pb-3 mb-2 -mx-1 px-1 scrollbar-hide">
        {/* Account filter */}
        <div className="relative shrink-0">
          <button
            onClick={() => {
              setShowAccountDD((v) => !v)
              setShowCategoryDD(false)
            }}
            className="flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors"
            style={{
              backgroundColor: accountFilter
                ? "rgba(59,130,246,0.25)"
                : "rgba(255,255,255,0.08)",
              color: accountFilter ? "#60A5FA" : "#94A3B8",
            }}
          >
            <Filter className="h-3 w-3" />
            {accountFilter
              ? `${accountMap[accountFilter]?.institution ?? "Account"} ••${accountMap[accountFilter]?.last4 ?? ""}`
              : "All Accounts"}
          </button>
          {showAccountDD && (
            <AccountDropdown
              accounts={accounts}
              selected={accountFilter}
              onSelect={(id) => {
                setAccountFilter(id)
                setShowAccountDD(false)
              }}
              onClose={() => setShowAccountDD(false)}
            />
          )}
        </div>

        {/* Category filter */}
        <div className="relative shrink-0">
          <button
            onClick={() => {
              setShowCategoryDD((v) => !v)
              setShowAccountDD(false)
            }}
            className="flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors"
            style={{
              backgroundColor: categoryFilter
                ? "rgba(59,130,246,0.25)"
                : "rgba(255,255,255,0.08)",
              color: categoryFilter ? "#60A5FA" : "#94A3B8",
            }}
          >
            <Filter className="h-3 w-3" />
            {categoryFilter ?? "All Categories"}
          </button>
          {showCategoryDD && (
            <CategoryDropdown
              selected={categoryFilter}
              onSelect={(cat) => {
                setCategoryFilter(cat)
                setShowCategoryDD(false)
              }}
              onClose={() => setShowCategoryDD(false)}
            />
          )}
        </div>

        {/* Date range pills */}
        {(
          [
            { key: "this-month", label: "This Month" },
            { key: "last-month", label: "Last Month" },
            { key: "3-months", label: "3 Months" },
          ] as { key: DatePreset; label: string }[]
        ).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setDatePreset(key)}
            className="shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors"
            style={{
              backgroundColor:
                datePreset === key
                  ? "rgba(59,130,246,0.25)"
                  : "rgba(255,255,255,0.08)",
              color: datePreset === key ? "#60A5FA" : "#94A3B8",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Transaction List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      ) : grouped.length === 0 ? (
        <div className="py-20 text-center">
          <p className="text-sm text-slate-500">No transactions found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map((group) => (
            <div key={group.date}>
              {/* Day header */}
              <div className="mb-2 px-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {group.label}
                </span>
              </div>

              {/* Transactions */}
              <div className="space-y-1.5">
                {group.txs.map((tx) =>
                  editingId === tx.id ? (
                    <EditRow
                      key={tx.id}
                      tx={tx}
                      account={accountMap[tx.accountId]}
                      onSave={async (updates) => {
                        await fetch("/api/transactions", {
                          method: "PUT",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ id: tx.id, ...updates }),
                        })
                        setEditingId(null)
                        fetchTransactions()
                      }}
                      onCancel={() => setEditingId(null)}
                    />
                  ) : (
                    <TransactionRow
                      key={tx.id}
                      tx={tx}
                      account={accountMap[tx.accountId]}
                      onTap={() => {
                        if (tx.needsReview) setEditingId(tx.id)
                      }}
                    />
                  )
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* FAB */}
      <button
        onClick={() => setShowAddForm(true)}
        className="fixed bottom-24 right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full shadow-lg shadow-blue-500/30 transition-transform active:scale-90"
        style={{ backgroundColor: "#3B82F6" }}
      >
        <Plus className="h-6 w-6 text-white" />
      </button>

      {/* Add Transaction Sheet */}
      {showAddForm && (
        <AddTransactionSheet
          accounts={accounts}
          onClose={() => setShowAddForm(false)}
          onCreated={() => {
            setShowAddForm(false)
            fetchTransactions()
            refreshTransactions()
          }}
        />
      )}
    </div>
  )
}

// ── Transaction Row ─────────────────────────────────────────
function TransactionRow({
  tx,
  account,
  onTap,
}: {
  tx: Transaction
  account?: Account
  onTap: () => void
}) {
  const [imgError, setImgError] = useState(false)
  const logoUrl = account ? getLogoUrl(account.institutionDomain) : null
  const showLogo = logoUrl && !imgError
  const initials = account ? getInitials(account.institution) : "?"
  const bgColor = account ? getInstitutionColor(account.institution) : "#475569"
  const isCredit = tx.amount > 0
  const catColor = getCategoryColor(tx.category)

  return (
    <button
      onClick={onTap}
      className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-all active:scale-[0.99]"
      style={{ backgroundColor: "#1B2A4A" }}
    >
      {/* Logo + last4 */}
      <div className="relative shrink-0">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-full overflow-hidden"
          style={{ backgroundColor: showLogo ? "#fff" : bgColor }}
        >
          {showLogo ? (
            <img
              src={logoUrl}
              alt={account?.institution ?? ""}
              className="h-5 w-5 object-contain"
              onError={() => setImgError(true)}
            />
          ) : (
            <span className="text-[0.625rem] font-bold text-white">
              {initials}
            </span>
          )}
        </div>
        {/* Needs review amber dot */}
        {tx.needsReview && (
          <span
            className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2"
            style={{
              backgroundColor: "#F59E0B",
              borderColor: "#0F1A2E",
            }}
          />
        )}
      </div>

      {/* Description + category */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          {account?.last4 && (
            <span className="shrink-0 text-[0.625rem] text-slate-600 font-mono">
              ••{account.last4}
            </span>
          )}
          <span className="truncate text-sm font-medium text-white">
            {tx.description}
          </span>
        </div>
        <div className="mt-1 flex items-center gap-1.5">
          <span
            className="inline-block rounded-full px-2 py-0.5 text-[0.625rem] font-medium"
            style={{ backgroundColor: catColor.bg, color: catColor.text }}
          >
            {tx.category}
          </span>
        </div>
      </div>

      {/* Amount + date */}
      <div className="shrink-0 text-right">
        <div className="flex items-center justify-end gap-1">
          {isCredit ? (
            <ArrowDownLeft className="h-3 w-3" style={{ color: "#4ADE80" }} />
          ) : (
            <ArrowUpRight className="h-3 w-3 text-slate-400" />
          )}
          <span
            className="text-sm font-semibold tabular-nums"
            style={{ color: isCredit ? "#4ADE80" : "#fff" }}
          >
            {formatCurrency(Math.abs(tx.amount), account?.currency ?? "GBP")}
          </span>
        </div>
        <span className="text-[0.625rem] text-slate-500">
          {formatDateShort(tx.date)}
        </span>
      </div>
    </button>
  )
}

// ── Edit Row (inline) ───────────────────────────────────────
function EditRow({
  tx,
  account,
  onSave,
  onCancel,
}: {
  tx: Transaction
  account?: Account
  onSave: (updates: Partial<Transaction>) => Promise<void>
  onCancel: () => void
}) {
  const [description, setDescription] = useState(tx.description)
  const [category, setCategory] = useState(tx.category)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    await onSave({ description, category, needsReview: false })
    setSaving(false)
  }

  return (
    <div
      className="rounded-xl px-3 py-3 space-y-2.5"
      style={{ backgroundColor: "#1B2A4A", border: "1px solid rgba(245,158,11,0.35)" }}
    >
      <div className="flex items-center gap-2">
        <span className="text-[0.625rem] font-medium uppercase tracking-wider text-amber-400">
          Needs review
        </span>
        {account && (
          <span className="text-[0.625rem] text-slate-500 font-mono">
            {account.institution} ••{account.last4}
          </span>
        )}
      </div>

      <input
        type="text"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        className="w-full rounded-lg px-3 py-2 text-sm text-white outline-none"
        style={{ backgroundColor: "rgba(255,255,255,0.06)" }}
      />

      <select
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        className="w-full rounded-lg px-3 py-2 text-sm text-white outline-none appearance-none"
        style={{ backgroundColor: "rgba(255,255,255,0.06)" }}
      >
        {TRANSACTION_CATEGORIES.map((cat) => (
          <option key={cat} value={cat} className="bg-slate-800">
            {cat}
          </option>
        ))}
      </select>

      <div className="flex items-center gap-2 justify-end">
        <button
          onClick={onCancel}
          className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-400"
          style={{ backgroundColor: "rgba(255,255,255,0.06)" }}
        >
          <X className="h-3 w-3" /> Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-white"
          style={{ backgroundColor: "#3B82F6" }}
        >
          {saving ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Check className="h-3 w-3" />
          )}
          Save
        </button>
      </div>
    </div>
  )
}

// ── Account Dropdown ────────────────────────────────────────
function AccountDropdown({
  accounts,
  selected,
  onSelect,
  onClose,
}: {
  accounts: Account[]
  selected: number | null
  onSelect: (id: number | null) => void
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [onClose])

  return (
    <div
      ref={ref}
      className="absolute left-0 top-full mt-1.5 z-40 w-56 rounded-xl py-1.5 shadow-xl"
      style={{ backgroundColor: "#1B2A4A", border: "1px solid rgba(255,255,255,0.1)" }}
    >
      <button
        onClick={() => onSelect(null)}
        className="w-full px-3.5 py-2 text-left text-xs font-medium transition-colors"
        style={{ color: selected === null ? "#60A5FA" : "#94A3B8" }}
      >
        All Accounts
      </button>
      {accounts.map((a) => (
        <button
          key={a.id}
          onClick={() => onSelect(a.id)}
          className="w-full px-3.5 py-2 text-left text-xs font-medium transition-colors"
          style={{ color: selected === a.id ? "#60A5FA" : "#CBD5E1" }}
        >
          {a.institution} ••{a.last4}
        </button>
      ))}
    </div>
  )
}

// ── Category Dropdown ───────────────────────────────────────
function CategoryDropdown({
  selected,
  onSelect,
  onClose,
}: {
  selected: string | null
  onSelect: (cat: string | null) => void
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [onClose])

  return (
    <div
      ref={ref}
      className="absolute left-0 top-full mt-1.5 z-40 w-48 max-h-64 overflow-y-auto rounded-xl py-1.5 shadow-xl"
      style={{ backgroundColor: "#1B2A4A", border: "1px solid rgba(255,255,255,0.1)" }}
    >
      <button
        onClick={() => onSelect(null)}
        className="w-full px-3.5 py-2 text-left text-xs font-medium transition-colors"
        style={{ color: selected === null ? "#60A5FA" : "#94A3B8" }}
      >
        All Categories
      </button>
      {TRANSACTION_CATEGORIES.map((cat) => {
        const c = getCategoryColor(cat)
        return (
          <button
            key={cat}
            onClick={() => onSelect(cat)}
            className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-xs font-medium transition-colors"
            style={{ color: selected === cat ? "#60A5FA" : "#CBD5E1" }}
          >
            <span
              className="h-2 w-2 rounded-full shrink-0"
              style={{ backgroundColor: c.text }}
            />
            {cat}
          </button>
        )
      })}
    </div>
  )
}

// ── Add Transaction Sheet ───────────────────────────────────
function AddTransactionSheet({
  accounts,
  onClose,
  onCreated,
}: {
  accounts: Account[]
  onClose: () => void
  onCreated: () => void
}) {
  const today = new Date().toISOString().slice(0, 10)
  const [date, setDate] = useState(today)
  const [amount, setAmount] = useState("")
  const [description, setDescription] = useState("")
  const [accountId, setAccountId] = useState<number>(accounts[0]?.id ?? 0)
  const [category, setCategory] = useState<string>("Uncategorised")
  const [isTransfer, setIsTransfer] = useState(false)
  const [destAccountId, setDestAccountId] = useState<number>(
    accounts[1]?.id ?? accounts[0]?.id ?? 0
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  // Auto-suggest category when description changes
  useEffect(() => {
    if (!description.trim() || description.length < 3) return
    const timeout = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/transactions/categorise?description=${encodeURIComponent(description)}`
        )
        if (res.ok) {
          const data = await res.json()
          if (data.category) setCategory(data.category)
        }
      } catch {
        // ignore — user can set manually
      }
    }, 600)
    return () => clearTimeout(timeout)
  }, [description])

  const handleSubmit = async () => {
    setError("")
    const amt = parseFloat(amount)
    if (!amount || isNaN(amt)) {
      setError("Enter a valid amount")
      return
    }
    if (!description.trim()) {
      setError("Enter a description")
      return
    }
    if (!accountId) {
      setError("Select an account")
      return
    }

    setSaving(true)
    try {
      // Create main transaction (negative for debit)
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId,
          date,
          description,
          amount: -Math.abs(amt),
          category: isTransfer ? "Transfer" : category,
          isTransfer,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || "Failed to save")
        setSaving(false)
        return
      }

      // If transfer, create matching credit on destination
      if (isTransfer && destAccountId && destAccountId !== accountId) {
        const mainTx = await res.json()
        await fetch("/api/transactions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accountId: destAccountId,
            date,
            description: `Transfer from ${accounts.find((a) => a.id === accountId)?.institution ?? "account"}`,
            amount: Math.abs(amt),
            category: "Transfer",
            isTransfer: true,
            linkedTransactionId: mainTx.id,
          }),
        })
      }

      onCreated()
    } catch {
      setError("Network error")
    }
    setSaving(false)
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl px-5 pt-5 pb-8 max-h-[85vh] overflow-y-auto"
        style={{ backgroundColor: "#0F1A2E" }}
      >
        {/* Handle */}
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-slate-600" />

        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-white">Add Transaction</h2>
          <button onClick={onClose}>
            <X className="h-5 w-5 text-slate-400" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Date */}
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">
              Date
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-xl px-3.5 py-2.5 text-sm text-white outline-none"
              style={{ backgroundColor: "#1B2A4A" }}
            />
          </div>

          {/* Amount */}
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">
              Amount
            </label>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-600 outline-none"
              style={{ backgroundColor: "#1B2A4A" }}
            />
          </div>

          {/* Description */}
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">
              Description
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Tesco, Netflix, Salary"
              className="w-full rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-600 outline-none"
              style={{ backgroundColor: "#1B2A4A" }}
            />
          </div>

          {/* Account */}
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">
              Account
            </label>
            <select
              value={accountId}
              onChange={(e) => setAccountId(Number(e.target.value))}
              className="w-full rounded-xl px-3.5 py-2.5 text-sm text-white outline-none appearance-none"
              style={{ backgroundColor: "#1B2A4A" }}
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id} className="bg-slate-800">
                  {a.institution} ••{a.last4} ({a.accountName})
                </option>
              ))}
            </select>
          </div>

          {/* Category */}
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-xl px-3.5 py-2.5 text-sm text-white outline-none appearance-none"
              style={{ backgroundColor: "#1B2A4A" }}
            >
              {TRANSACTION_CATEGORIES.map((cat) => (
                <option key={cat} value={cat} className="bg-slate-800">
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Transfer toggle */}
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-slate-400">
              Transfer between accounts
            </label>
            <button
              onClick={() => setIsTransfer((v) => !v)}
              className="relative h-6 w-11 rounded-full transition-colors"
              style={{
                backgroundColor: isTransfer
                  ? "#3B82F6"
                  : "rgba(255,255,255,0.12)",
              }}
            >
              <span
                className="absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform"
                style={{
                  left: isTransfer ? "calc(100% - 1.375rem)" : "0.125rem",
                }}
              />
            </button>
          </div>

          {/* Destination account (if transfer) */}
          {isTransfer && (
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">
                Destination Account
              </label>
              <select
                value={destAccountId}
                onChange={(e) => setDestAccountId(Number(e.target.value))}
                className="w-full rounded-xl px-3.5 py-2.5 text-sm text-white outline-none appearance-none"
                style={{ backgroundColor: "#1B2A4A" }}
              >
                {accounts
                  .filter((a) => a.id !== accountId)
                  .map((a) => (
                    <option key={a.id} value={a.id} className="bg-slate-800">
                      {a.institution} ••{a.last4} ({a.accountName})
                    </option>
                  ))}
              </select>
            </div>
          )}

          {/* Error */}
          {error && (
            <p className="text-xs font-medium text-red-400">{error}</p>
          )}

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white transition-opacity disabled:opacity-50"
            style={{ backgroundColor: "#3B82F6" }}
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            {saving ? "Saving..." : "Add Transaction"}
          </button>
        </div>
      </div>
    </>
  )
}
