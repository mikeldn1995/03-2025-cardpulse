"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { Plus, ChevronRight, X } from "lucide-react"
import { useStore } from "@/lib/store"
import { useToast } from "@/components/toast"
import {
  formatCurrency,
  getLogoUrl,
  getInitials,
  getInstitutionColor,
  categoryLabel,
} from "@/lib/utils"
import type { Account } from "@/types"
import { ACCOUNT_CATEGORIES } from "@/types"
import type { AccountCategory } from "@/types"

const GROUP_ORDER: AccountCategory[] = [
  "current_account",
  "savings",
  "isa",
  "investment",
  "crypto",
  "credit_card",
  "loan",
  "mortgage",
]

interface NewAccountForm {
  institution: string
  accountName: string
  category: AccountCategory
  last4: string
  currency: string
  balance: string
  creditLimit: string
}

const EMPTY_FORM: NewAccountForm = {
  institution: "",
  accountName: "",
  category: "current_account",
  last4: "",
  currency: "GBP",
  balance: "0",
  creditLimit: "",
}

export default function AccountsListPage() {
  const { accounts, refreshAccounts } = useStore()
  const { toast } = useToast()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<NewAccountForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  // ── Group accounts by category ──────────────────────────
  const grouped = useMemo(() => {
    return accounts.reduce(
      (acc, account) => {
        const cat = account.category
        if (!acc[cat]) acc[cat] = []
        acc[cat].push(account)
        return acc
      },
      {} as Record<string, Account[]>
    )
  }, [accounts])

  const sortedGroups = GROUP_ORDER.filter((cat) => grouped[cat]?.length > 0)

  // ── Create account ──────────────────────────────────────
  const handleCreate = async () => {
    if (!form.institution.trim()) {
      toast("Institution name is required")
      return
    }
    setSaving(true)
    try {
      const body: Record<string, unknown> = {
        institution: form.institution.trim(),
        accountName: form.accountName.trim(),
        category: form.category,
        last4: form.last4.trim(),
        currency: form.currency || "GBP",
        balance: parseFloat(form.balance) || 0,
      }
      if (form.creditLimit.trim()) {
        body.creditLimit = parseFloat(form.creditLimit)
      }
      const res = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error("Failed to create account")
      await refreshAccounts()
      setForm(EMPTY_FORM)
      setShowForm(false)
      toast("Account created")
    } catch {
      toast("Failed to create account")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-white">Accounts</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: "#3B82F6" }}
        >
          {showForm ? (
            <>
              <X className="h-4 w-4" />
              Cancel
            </>
          ) : (
            <>
              <Plus className="h-4 w-4" />
              Add Account
            </>
          )}
        </button>
      </div>

      {/* Inline Add Form */}
      {showForm && (
        <div
          className="rounded-2xl p-5 space-y-4"
          style={{ backgroundColor: "#1B2A4A" }}
        >
          <h2 className="text-sm font-semibold text-white">New Account</h2>

          <div className="grid grid-cols-2 gap-3">
            {/* Institution */}
            <div className="col-span-2">
              <label className="block text-xs text-slate-400 mb-1">
                Institution Name
              </label>
              <input
                type="text"
                value={form.institution}
                onChange={(e) =>
                  setForm((f) => ({ ...f, institution: e.target.value }))
                }
                placeholder="e.g. Barclays"
                className="w-full h-10 px-3 text-sm text-white bg-white/5 border border-white/10 rounded-xl outline-none focus:border-blue-500 placeholder:text-slate-500"
              />
            </div>

            {/* Account Name */}
            <div className="col-span-2">
              <label className="block text-xs text-slate-400 mb-1">
                Account Name
              </label>
              <input
                type="text"
                value={form.accountName}
                onChange={(e) =>
                  setForm((f) => ({ ...f, accountName: e.target.value }))
                }
                placeholder="e.g. Everyday Saver"
                className="w-full h-10 px-3 text-sm text-white bg-white/5 border border-white/10 rounded-xl outline-none focus:border-blue-500 placeholder:text-slate-500"
              />
            </div>

            {/* Category */}
            <div>
              <label className="block text-xs text-slate-400 mb-1">
                Category
              </label>
              <select
                value={form.category}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    category: e.target.value as AccountCategory,
                  }))
                }
                className="w-full h-10 px-3 text-sm text-white bg-white/5 border border-white/10 rounded-xl outline-none focus:border-blue-500 appearance-none"
              >
                {ACCOUNT_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Last 4 */}
            <div>
              <label className="block text-xs text-slate-400 mb-1">
                Last 4 Digits
              </label>
              <input
                type="text"
                value={form.last4}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    last4: e.target.value.replace(/\D/g, "").slice(0, 4),
                  }))
                }
                placeholder="1234"
                maxLength={4}
                className="w-full h-10 px-3 text-sm text-white bg-white/5 border border-white/10 rounded-xl outline-none focus:border-blue-500 placeholder:text-slate-500 font-mono"
              />
            </div>

            {/* Currency */}
            <div>
              <label className="block text-xs text-slate-400 mb-1">
                Currency
              </label>
              <select
                value={form.currency}
                onChange={(e) =>
                  setForm((f) => ({ ...f, currency: e.target.value }))
                }
                className="w-full h-10 px-3 text-sm text-white bg-white/5 border border-white/10 rounded-xl outline-none focus:border-blue-500 appearance-none"
              >
                <option value="GBP">GBP</option>
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
              </select>
            </div>

            {/* Balance */}
            <div>
              <label className="block text-xs text-slate-400 mb-1">
                Balance
              </label>
              <input
                type="number"
                step="0.01"
                value={form.balance}
                onChange={(e) =>
                  setForm((f) => ({ ...f, balance: e.target.value }))
                }
                className="w-full h-10 px-3 text-sm text-white bg-white/5 border border-white/10 rounded-xl outline-none focus:border-blue-500 tabular-nums"
              />
            </div>

            {/* Credit Limit (optional) */}
            <div className="col-span-2">
              <label className="block text-xs text-slate-400 mb-1">
                Credit Limit{" "}
                <span className="text-slate-500">(optional)</span>
              </label>
              <input
                type="number"
                step="0.01"
                value={form.creditLimit}
                onChange={(e) =>
                  setForm((f) => ({ ...f, creditLimit: e.target.value }))
                }
                placeholder="Leave blank if N/A"
                className="w-full h-10 px-3 text-sm text-white bg-white/5 border border-white/10 rounded-xl outline-none focus:border-blue-500 placeholder:text-slate-500 tabular-nums"
              />
            </div>
          </div>

          <button
            onClick={handleCreate}
            disabled={saving || !form.institution.trim()}
            className="w-full h-11 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
            style={{ backgroundColor: "#3B82F6" }}
          >
            {saving ? "Creating..." : "Create Account"}
          </button>
        </div>
      )}

      {/* Empty State */}
      {accounts.length === 0 && !showForm && (
        <div
          className="rounded-2xl p-8 text-center"
          style={{ backgroundColor: "#1B2A4A" }}
        >
          <p className="text-sm text-slate-400 mb-4">
            No accounts yet. Add your first account to get started.
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: "#3B82F6" }}
          >
            <Plus className="h-4 w-4" />
            Add Account
          </button>
        </div>
      )}

      {/* Grouped Account List */}
      <div className="space-y-6">
        {sortedGroups.map((cat) => {
          const accts = grouped[cat]
          const groupTotal = accts.reduce((s, a) => s + a.balance, 0)

          return (
            <div key={cat}>
              {/* Group Header */}
              <div className="mb-2.5 flex items-center justify-between px-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  {categoryLabel(cat)}
                </span>
                <span className="text-xs font-semibold tabular-nums text-slate-300">
                  {formatCurrency(groupTotal, accts[0]?.currency ?? "GBP")}
                </span>
              </div>

              {/* Account Cards */}
              <div className="space-y-2">
                {accts.map((account) => (
                  <AccountCard key={account.id} account={account} />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Account Card ────────────────────────────────────────────

function AccountCard({ account }: { account: Account }) {
  const logoUrl = getLogoUrl(account.institutionDomain)
  const initials = getInitials(account.institution)
  const bgColor = getInstitutionColor(account.institution)
  const [imgError, setImgError] = useState(false)

  const showLogo = logoUrl && !imgError

  return (
    <Link
      href={`/accounts/${account.id}`}
      className="flex items-center gap-3.5 rounded-2xl px-4 py-3.5 transition-all active:scale-[0.98]"
      style={{ backgroundColor: "#1B2A4A" }}
    >
      {/* Logo / Initials */}
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full overflow-hidden"
        style={{ backgroundColor: showLogo ? "#fff" : bgColor }}
      >
        {showLogo ? (
          <img
            src={logoUrl}
            alt={account.institution}
            className="h-6 w-6 object-contain"
            onError={() => setImgError(true)}
          />
        ) : (
          <span className="text-xs font-bold text-white">{initials}</span>
        )}
      </div>

      {/* Name + Details */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-semibold text-white">
            {account.accountName || account.institution}
          </span>
          {account.last4 && (
            <span className="shrink-0 text-xs text-slate-500 font-mono">
              ••{account.last4}
            </span>
          )}
        </div>
        <p className="text-xs text-slate-400 mt-0.5">
          {account.institution}
          {account.currency !== "GBP" && (
            <span className="ml-1.5 text-slate-500">{account.currency}</span>
          )}
        </p>
      </div>

      {/* Balance */}
      <div className="shrink-0 text-right">
        <span className="text-sm font-semibold tabular-nums text-white">
          {formatCurrency(account.balance, account.currency)}
        </span>
      </div>

      <ChevronRight className="h-4 w-4 shrink-0 text-slate-500" />
    </Link>
  )
}
