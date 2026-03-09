"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import {
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  Pencil,
  Trash2,
  Upload,
  TrendingUp,
  CreditCard,
  Wallet,
  Check,
  X,
} from "lucide-react"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { useStore } from "@/lib/store"
import { useToast } from "@/components/toast"
import {
  formatCurrency,
  formatDate,
  getLogoUrl,
  getInitials,
  getInstitutionColor,
  categoryLabel,
  getEffectiveApr,
  isStale,
} from "@/lib/utils"
import type { Account, Transaction } from "@/types"
import { ACCOUNT_CATEGORIES } from "@/types"
import type { AccountCategory } from "@/types"

// ── Section Wrapper ─────────────────────────────────────────

function Section({
  title,
  icon: Icon,
  defaultOpen = true,
  children,
}: {
  title: string
  icon?: React.ElementType
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ backgroundColor: "#1B2A4A" }}
    >
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3.5"
      >
        <div className="flex items-center gap-2">
          {Icon && <Icon className="h-4 w-4 text-slate-400" />}
          <span className="text-sm font-semibold text-white">{title}</span>
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 text-slate-400" />
        ) : (
          <ChevronDown className="h-4 w-4 text-slate-400" />
        )}
      </button>
      {open && (
        <div className="px-4 pb-4 border-t border-white/5">{children}</div>
      )}
    </div>
  )
}

// ── Editable Field ──────────────────────────────────────────

function EditableField({
  label,
  value,
  displayValue,
  type = "text",
  onSave,
  suffix,
  step,
  options,
}: {
  label: string
  value: string | number | null
  displayValue?: string
  type?: "text" | "number" | "date" | "select"
  onSave: (val: string) => void
  suffix?: string
  step?: string
  options?: { value: string; label: string }[]
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(String(value ?? ""))

  const handleSave = () => {
    setEditing(false)
    onSave(draft)
  }

  return (
    <div className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
      <span className="text-xs text-slate-400">{label}</span>
      {editing ? (
        <div className="flex items-center gap-1.5">
          {type === "select" && options ? (
            <select
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="h-7 px-2 text-sm text-white bg-white/10 border border-white/20 rounded-lg outline-none"
            >
              {options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          ) : (
            <input
              type={type}
              value={draft}
              step={step}
              onChange={(e) => setDraft(e.target.value)}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave()
                if (e.key === "Escape") setEditing(false)
              }}
              className="h-7 w-28 px-2 text-sm text-white bg-white/10 border border-white/20 rounded-lg outline-none text-right"
            />
          )}
          {suffix && (
            <span className="text-xs text-slate-400">{suffix}</span>
          )}
          <button
            onClick={handleSave}
            className="h-7 w-7 flex items-center justify-center text-green-400 hover:bg-white/5 rounded-lg"
          >
            <Check className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setEditing(false)}
            className="h-7 w-7 flex items-center justify-center text-slate-400 hover:bg-white/5 rounded-lg"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <button
          onClick={() => {
            setDraft(String(value ?? ""))
            setEditing(true)
          }}
          className="flex items-center gap-1.5 group"
        >
          <span className="text-sm text-white tabular-nums">
            {displayValue ?? String(value ?? "--")}
            {suffix && (
              <span className="text-slate-400 ml-0.5">{suffix}</span>
            )}
          </span>
          <Pencil className="h-3 w-3 text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
      )}
    </div>
  )
}

// ── Balance Chart Tooltip ───────────────────────────────────

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: { value: number }[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div
      className="rounded-lg px-3 py-2 text-xs shadow-lg border border-white/10"
      style={{ backgroundColor: "#0F1A2E" }}
    >
      <p className="text-slate-400">{label}</p>
      <p className="text-white font-semibold tabular-nums">
        {formatCurrency(payload[0].value)}
      </p>
    </div>
  )
}

// ── Main Page ───────────────────────────────────────────────

export default function AccountDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { accounts, refreshAccounts } = useStore()
  const { toast } = useToast()

  const accountId = Number(params.id)

  const [account, setAccount] = useState<Account | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [updatingBalance, setUpdatingBalance] = useState(false)
  const [newBalance, setNewBalance] = useState("")
  const [txCount, setTxCount] = useState(0)

  // ── Fetch data ──────────────────────────────────────────
  const fetchData = useCallback(async () => {
    try {
      const [acctRes, txRes] = await Promise.all([
        fetch("/api/accounts"),
        fetch(`/api/transactions?accountId=${accountId}&limit=20`),
      ])

      if (acctRes.ok) {
        const accts: Account[] = await acctRes.json()
        const found = accts.find((a) => a.id === accountId)
        if (found) setAccount(found)
        else {
          toast("Account not found")
          router.push("/accounts")
          return
        }
      }

      if (txRes.ok) {
        const txData = await txRes.json()
        setTransactions(Array.isArray(txData) ? txData : [])
      }
    } catch {
      toast("Failed to load account")
    } finally {
      setLoading(false)
    }
  }, [accountId, router, toast])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Also try to get count of all transactions for delete summary
  useEffect(() => {
    fetch(`/api/transactions?accountId=${accountId}&limit=9999`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setTxCount(data.length)
      })
      .catch(() => {})
  }, [accountId])

  // ── Update account ──────────────────────────────────────
  const updateAccount = async (updates: Partial<Account>) => {
    if (!account) return
    try {
      const res = await fetch("/api/accounts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: account.id, ...updates }),
      })
      if (res.ok) {
        const updated = await res.json()
        setAccount(updated)
        await refreshAccounts()
        toast("Saved")
      } else {
        toast("Failed to save")
      }
    } catch {
      toast("Failed to save")
    }
  }

  // ── Delete account ──────────────────────────────────────
  const handleDelete = async () => {
    if (!account) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/accounts?id=${account.id}`, {
        method: "DELETE",
      })
      if (res.ok) {
        await refreshAccounts()
        toast("Account deleted")
        router.push("/accounts")
      } else {
        toast("Failed to delete")
      }
    } catch {
      toast("Failed to delete")
    } finally {
      setDeleting(false)
    }
  }

  // ── Update balance ──────────────────────────────────────
  const handleUpdateBalance = async () => {
    const bal = parseFloat(newBalance)
    if (isNaN(bal)) return
    await updateAccount({
      balance: bal,
      balanceUpdatedAt: new Date().toISOString(),
    })
    setUpdatingBalance(false)
    setNewBalance("")
  }

  // ── Balance chart data (from account snapshots or single point) ──
  const chartData = useMemo(() => {
    if (!account) return []
    // For now show the current balance as the only data point
    // When balance snapshots API is available, this will show history
    const now = new Date()
    return [
      {
        date: formatDate(
          new Date(now.getTime() - 30 * 86400000).toISOString()
        ),
        balance: account.balance,
      },
      {
        date: formatDate(
          new Date(now.getTime() - 15 * 86400000).toISOString()
        ),
        balance: account.balance,
      },
      {
        date: formatDate(now.toISOString()),
        balance: account.balance,
      },
    ]
  }, [account])

  // ── Loading state ───────────────────────────────────────
  if (loading || !account) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-sm text-slate-400">Loading...</div>
      </div>
    )
  }

  const logoUrl = getLogoUrl(account.institutionDomain)
  const initials = getInitials(account.institution)
  const bgColor = getInstitutionColor(account.institution)
  const effectiveApr = getEffectiveApr(account)
  const stale = isStale(account.balanceUpdatedAt)

  const ddLabels: Record<string, string> = {
    minimum: "Minimum payment",
    custom: account.ddAmount
      ? `Custom - ${formatCurrency(account.ddAmount, account.currency)}`
      : "Custom",
    full: "Full balance",
    none: "Not set up",
  }

  return (
    <div className="space-y-4 pb-8">
      {/* Back Button */}
      <button
        onClick={() => router.push("/accounts")}
        className="flex items-center gap-1 text-sm text-slate-400 hover:text-white transition-colors -ml-1"
      >
        <ChevronLeft className="h-4 w-4" />
        Accounts
      </button>

      {/* Hero: Logo + Balance */}
      <div className="text-center pt-2 pb-4">
        {/* Bank Logo */}
        <div className="flex justify-center mb-4">
          <LogoCircle
            logoUrl={logoUrl}
            initials={initials}
            bgColor={bgColor}
            institution={account.institution}
            size="lg"
          />
        </div>

        {/* Balance */}
        <p className="text-4xl font-bold tracking-tight tabular-nums text-white">
          {formatCurrency(account.balance, account.currency)}
        </p>

        {/* Credit utilisation */}
        {account.creditLimit && (
          <div className="mt-2 flex items-center justify-center gap-2">
            <div
              className="h-1.5 w-32 rounded-full overflow-hidden"
              style={{ backgroundColor: "rgba(255,255,255,0.08)" }}
            >
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.min(
                    (Math.abs(account.balance) / account.creditLimit) * 100,
                    100
                  )}%`,
                  backgroundColor: getUtilColor(
                    (Math.abs(account.balance) / account.creditLimit) * 100
                  ),
                }}
              />
            </div>
            <span className="text-xs tabular-nums text-slate-400">
              {Math.round(
                (Math.abs(account.balance) / account.creditLimit) * 100
              )}
              % used
            </span>
          </div>
        )}

        {/* Account name + Institution */}
        <p className="mt-3 text-sm font-medium text-white">
          {account.accountName || account.institution}
        </p>
        <p className="text-xs text-slate-400">
          {account.institution}
          {account.last4 && (
            <span className="font-mono ml-1.5">••{account.last4}</span>
          )}
        </p>

        {/* Stale indicator */}
        {stale && (
          <div
            className="mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1"
            style={{ backgroundColor: "rgba(245, 158, 11, 0.15)" }}
          >
            <div className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            <span className="text-xs text-amber-300">
              Balance may be outdated
            </span>
          </div>
        )}
      </div>

      {/* ── Balance History ──────────────────────────────── */}
      <Section title="Balance History" icon={TrendingUp}>
        <div className="pt-3 -mx-2">
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="balGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#3B82F6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: "#64748B" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "#64748B" }}
                axisLine={false}
                tickLine={false}
                width={60}
                tickFormatter={(v: number) => formatCurrency(v, account.currency)}
              />
              <Tooltip content={<ChartTooltip />} />
              <Area
                type="monotone"
                dataKey="balance"
                stroke="#3B82F6"
                strokeWidth={2}
                fill="url(#balGrad)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <p className="text-[0.6875rem] text-slate-500 mt-2">
          Balance history will show more data as snapshots accumulate.
        </p>
      </Section>

      {/* ── Recent Transactions ──────────────────────────── */}
      <Section title="Recent Transactions" icon={Wallet} defaultOpen={true}>
        {transactions.length === 0 ? (
          <p className="text-sm text-slate-400 py-4 text-center">
            No transactions yet
          </p>
        ) : (
          <div className="divide-y divide-white/5 pt-2">
            {transactions.map((tx) => (
              <div
                key={tx.id}
                className="flex items-center justify-between py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-white truncate">
                    {tx.description}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-slate-500">
                      {formatDate(tx.date)}
                    </span>
                    <span
                      className="text-[0.625rem] px-1.5 py-0.5 rounded-full font-medium"
                      style={{
                        backgroundColor: "rgba(255,255,255,0.06)",
                        color: "#94A3B8",
                      }}
                    >
                      {tx.category}
                    </span>
                  </div>
                </div>
                <span
                  className={`text-sm font-semibold tabular-nums shrink-0 ml-3 ${
                    tx.amount >= 0 ? "text-green-400" : "text-white"
                  }`}
                >
                  {tx.amount >= 0 ? "+" : ""}
                  {formatCurrency(tx.amount, account.currency)}
                </span>
              </div>
            ))}
          </div>
        )}
        {transactions.length >= 20 && (
          <Link
            href={`/transactions?accountId=${account.id}`}
            className="block text-center text-xs text-blue-400 hover:text-blue-300 pt-3 font-medium"
          >
            View all transactions
          </Link>
        )}
      </Section>

      {/* ── Account Details ──────────────────────────────── */}
      <Section title="Account Details" icon={CreditCard} defaultOpen={false}>
        <div className="pt-2">
          <EditableField
            label="Category"
            value={account.category}
            displayValue={categoryLabel(account.category)}
            type="select"
            options={ACCOUNT_CATEGORIES.map((c) => ({
              value: c.value,
              label: c.label,
            }))}
            onSave={(v) =>
              updateAccount({ category: v as AccountCategory })
            }
          />
          <EditableField
            label="Currency"
            value={account.currency}
            type="select"
            options={[
              { value: "GBP", label: "GBP" },
              { value: "EUR", label: "EUR" },
              { value: "USD", label: "USD" },
            ]}
            onSave={(v) => updateAccount({ currency: v })}
          />
          <EditableField
            label="Last 4 digits"
            value={account.last4}
            displayValue={account.last4 || "--"}
            onSave={(v) =>
              updateAccount({ last4: v.replace(/\D/g, "").slice(0, 4) })
            }
          />

          {/* APR Section */}
          <EditableField
            label="Regular APR"
            value={account.aprRegular ?? ""}
            displayValue={
              account.aprRegular != null ? `${account.aprRegular}%` : "--"
            }
            type="number"
            step="0.1"
            suffix="%"
            onSave={(v) => {
              const n = parseFloat(v)
              updateAccount({ aprRegular: isNaN(n) ? null : n })
            }}
          />
          <EditableField
            label="Promo APR"
            value={account.aprPromo ?? ""}
            displayValue={
              account.aprPromo != null
                ? `${account.aprPromo}%${
                    account.promoUntil
                      ? ` until ${formatDate(account.promoUntil)}`
                      : ""
                  }`
                : "--"
            }
            type="number"
            step="0.1"
            suffix="%"
            onSave={(v) => {
              const n = parseFloat(v)
              updateAccount({ aprPromo: isNaN(n) ? null : n })
            }}
          />
          {account.aprPromo != null && (
            <EditableField
              label="Promo Expires"
              value={account.promoUntil?.split("T")[0] ?? ""}
              displayValue={
                account.promoUntil ? formatDate(account.promoUntil) : "--"
              }
              type="date"
              onSave={(v) => updateAccount({ promoUntil: v || null })}
            />
          )}
          <EditableField
            label="Effective APR"
            value={effectiveApr}
            displayValue={`${effectiveApr}%`}
            type="number"
            onSave={() => {}}
          />

          {/* Limits */}
          <EditableField
            label="Credit Limit"
            value={account.creditLimit ?? ""}
            displayValue={
              account.creditLimit != null
                ? formatCurrency(account.creditLimit, account.currency)
                : "--"
            }
            type="number"
            step="0.01"
            onSave={(v) => {
              const n = parseFloat(v)
              updateAccount({ creditLimit: isNaN(n) ? null : n })
            }}
          />
          <EditableField
            label="Overdraft Limit"
            value={account.overdraftLimit ?? ""}
            displayValue={
              account.overdraftLimit != null
                ? formatCurrency(account.overdraftLimit, account.currency)
                : "--"
            }
            type="number"
            step="0.01"
            onSave={(v) => {
              const n = parseFloat(v)
              updateAccount({ overdraftLimit: isNaN(n) ? null : n })
            }}
          />

          {/* Payment details */}
          <EditableField
            label="Statement Day"
            value={account.statementDay ?? ""}
            displayValue={
              account.statementDay != null
                ? `${ordinal(account.statementDay)} of each month`
                : "--"
            }
            type="number"
            step="1"
            onSave={(v) => {
              const n = parseInt(v)
              updateAccount({
                statementDay: isNaN(n)
                  ? null
                  : Math.max(1, Math.min(28, n)),
              })
            }}
          />
          <EditableField
            label="Payment Day"
            value={account.paymentDay ?? ""}
            displayValue={
              account.paymentDay != null
                ? `${ordinal(account.paymentDay)} of each month`
                : "--"
            }
            type="number"
            step="1"
            onSave={(v) => {
              const n = parseInt(v)
              updateAccount({
                paymentDay: isNaN(n)
                  ? null
                  : Math.max(1, Math.min(28, n)),
              })
            }}
          />

          {/* Direct Debit */}
          <div className="py-3 border-b border-white/5">
            <span className="text-xs text-slate-400 block mb-2">
              Direct Debit
            </span>
            <div className="space-y-1.5">
              {(["minimum", "custom", "full", "none"] as const).map((opt) => (
                <label
                  key={opt}
                  className="flex items-center gap-2 text-sm text-white cursor-pointer"
                >
                  <input
                    type="radio"
                    name="dd"
                    checked={account.dd === opt}
                    onChange={() => updateAccount({ dd: opt })}
                    className="w-3.5 h-3.5 accent-blue-500"
                  />
                  {opt === "minimum" && "Minimum payment"}
                  {opt === "custom" && (
                    <span className="flex items-center gap-1.5">
                      Custom
                      {account.dd === "custom" && (
                        <input
                          type="number"
                          value={account.ddAmount || ""}
                          onChange={(e) =>
                            updateAccount({
                              dd: "custom",
                              ddAmount: parseFloat(e.target.value) || 0,
                            })
                          }
                          className="w-20 h-7 px-2 text-sm text-white bg-white/10 border border-white/20 rounded-lg outline-none"
                          onClick={(e) => e.stopPropagation()}
                        />
                      )}
                    </span>
                  )}
                  {opt === "full" && "Full balance"}
                  {opt === "none" && "No direct debit"}
                </label>
              ))}
            </div>
          </div>
        </div>
      </Section>

      {/* ── Actions ──────────────────────────────────────── */}
      <div
        className="rounded-2xl p-4 space-y-3"
        style={{ backgroundColor: "#1B2A4A" }}
      >
        <h3 className="text-sm font-semibold text-white mb-1">Actions</h3>

        {/* Upload Statement */}
        <Link
          href="/upload"
          className="flex items-center gap-3 px-4 py-3 rounded-xl transition-colors hover:bg-white/5"
        >
          <Upload className="h-4 w-4 text-blue-400" />
          <span className="text-sm text-white">Upload Statement</span>
        </Link>

        {/* Update Balance */}
        {updatingBalance ? (
          <div className="px-4 py-3 rounded-xl bg-white/5">
            <p className="text-xs text-slate-400 mb-2">
              Enter new balance
            </p>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="0.01"
                value={newBalance}
                onChange={(e) => setNewBalance(e.target.value)}
                autoFocus
                placeholder="0.00"
                className="flex-1 h-10 px-3 text-sm text-white bg-white/10 border border-white/20 rounded-xl outline-none focus:border-blue-500 tabular-nums"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleUpdateBalance()
                  if (e.key === "Escape") setUpdatingBalance(false)
                }}
              />
              <button
                onClick={handleUpdateBalance}
                disabled={!newBalance}
                className="h-10 px-4 rounded-xl text-sm font-semibold text-white disabled:opacity-40"
                style={{ backgroundColor: "#3B82F6" }}
              >
                Save
              </button>
              <button
                onClick={() => {
                  setUpdatingBalance(false)
                  setNewBalance("")
                }}
                className="h-10 px-3 rounded-xl text-sm text-slate-400 hover:text-white"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => {
              setNewBalance(String(account.balance))
              setUpdatingBalance(true)
            }}
            className="flex items-center gap-3 px-4 py-3 rounded-xl transition-colors hover:bg-white/5 w-full text-left"
          >
            <Pencil className="h-4 w-4 text-blue-400" />
            <span className="text-sm text-white">Update Balance</span>
          </button>
        )}

        {/* Delete Account */}
        {showDeleteConfirm ? (
          <div className="px-4 py-3 rounded-xl border border-red-500/20 bg-red-500/5">
            <p className="text-sm text-red-300 font-medium mb-1">
              Delete this account?
            </p>
            <p className="text-xs text-slate-400 mb-3">
              This will permanently delete{" "}
              <span className="text-white font-medium">{txCount}</span>{" "}
              transaction{txCount !== 1 ? "s" : ""} and all balance
              snapshots.
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="h-9 px-4 rounded-xl text-sm font-semibold text-white bg-red-600 hover:bg-red-500 disabled:opacity-50"
              >
                {deleting ? "Deleting..." : "Confirm Delete"}
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="h-9 px-4 rounded-xl text-sm text-slate-400 hover:text-white"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="flex items-center gap-3 px-4 py-3 rounded-xl transition-colors hover:bg-red-500/5 w-full text-left"
          >
            <Trash2 className="h-4 w-4 text-red-400" />
            <span className="text-sm text-red-400">Delete Account</span>
          </button>
        )}
      </div>
    </div>
  )
}

// ── Logo Circle ─────────────────────────────────────────────

function LogoCircle({
  logoUrl,
  initials,
  bgColor,
  institution,
  size = "md",
}: {
  logoUrl: string | null
  initials: string
  bgColor: string
  institution: string
  size?: "md" | "lg"
}) {
  const [imgError, setImgError] = useState(false)
  const showLogo = logoUrl && !imgError

  const dims = size === "lg" ? "h-16 w-16" : "h-10 w-10"
  const imgDims = size === "lg" ? "h-10 w-10" : "h-6 w-6"
  const textSize = size === "lg" ? "text-lg" : "text-xs"

  return (
    <div
      className={`flex ${dims} shrink-0 items-center justify-center rounded-full overflow-hidden`}
      style={{ backgroundColor: showLogo ? "#fff" : bgColor }}
    >
      {showLogo ? (
        <img
          src={logoUrl}
          alt={institution}
          className={`${imgDims} object-contain`}
          onError={() => setImgError(true)}
        />
      ) : (
        <span className={`${textSize} font-bold text-white`}>{initials}</span>
      )}
    </div>
  )
}

// ── Utility helpers ─────────────────────────────────────────

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"]
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

function getUtilColor(util: number): string {
  if (util >= 90) return "#EF4444"
  if (util >= 75) return "#F59E0B"
  if (util >= 50) return "#3B82F6"
  return "#22C55E"
}
