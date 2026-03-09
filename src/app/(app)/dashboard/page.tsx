"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { Upload, AlertTriangle, ChevronRight, ArrowDownRight } from "lucide-react"
import { useStore } from "@/lib/store"
import type { Account } from "@/types"
import {
  formatCurrency,
  isDebtAccount,
  getLogoUrl,
  getInitials,
  getInstitutionColor,
  categoryLabel,
  isStale,
  getGreeting,
  getAccountAlerts,
} from "@/lib/utils"

type ViewMode = "net-worth" | "debts"

export default function DashboardPage() {
  const { accounts, userName } = useStore()
  const [viewMode, setViewMode] = useState<ViewMode>("net-worth")

  const firstName = userName ? userName.split(" ")[0] : "there"

  // ── Alerts ──────────────────────────────────────────────
  const alerts = useMemo(() => {
    const items: { id: string; label: string; type: "warning" | "info" }[] = []

    const staleAccounts = accounts.filter((a) => isStale(a.lastStatementDate))
    if (staleAccounts.length > 0) {
      items.push({
        id: "stale",
        label: `${staleAccounts.length} account${staleAccounts.length > 1 ? "s have" : " has"} stale data — upload statements`,
        type: "warning",
      })
    }

    for (const a of accounts) {
      const acctAlerts = getAccountAlerts(a)
      if (acctAlerts.includes("promo-expiring")) {
        items.push({
          id: `promo-${a.id}`,
          label: `Promo rate expiring on ${a.institution}`,
          type: "warning",
        })
      }
      if (acctAlerts.includes("no-dd")) {
        items.push({
          id: `nodd-${a.id}`,
          label: `${a.institution} ••${a.last4}: no Direct Debit set`,
          type: "warning",
        })
      }
    }

    return items
  }, [accounts])

  // ── Balances ────────────────────────────────────────────
  const netWorth = useMemo(
    () => accounts.reduce((sum, a) => sum + a.balance, 0),
    [accounts]
  )

  const debtTotal = useMemo(
    () =>
      accounts
        .filter((a) => isDebtAccount(a))
        .reduce((sum, a) => sum + a.balance, 0),
    [accounts]
  )

  const displayAmount = viewMode === "net-worth" ? netWorth : debtTotal
  const displayLabel = viewMode === "net-worth" ? "Net Worth" : "Total Debts"

  // ── Grouped Accounts ───────────────────────────────────
  const visibleAccounts =
    viewMode === "debts" ? accounts.filter((a) => isDebtAccount(a)) : accounts

  const grouped = useMemo(() => {
    return visibleAccounts.reduce(
      (acc, account) => {
        const cat = account.category
        if (!acc[cat]) acc[cat] = []
        acc[cat].push(account)
        return acc
      },
      {} as Record<string, Account[]>
    )
  }, [visibleAccounts])

  const groupOrder = [
    "current_account",
    "savings",
    "isa",
    "investment",
    "crypto",
    "credit_card",
    "loan",
    "mortgage",
  ]

  const sortedGroups = groupOrder.filter((cat) => grouped[cat]?.length > 0)

  // ── Empty State ─────────────────────────────────────────
  if (accounts.length === 0) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="w-full rounded-2xl p-8 text-center bg-white shadow-sm border border-border">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
            <Upload className="h-7 w-7 text-muted-foreground" />
          </div>
          <h2 className="mb-2 text-lg font-semibold text-[#1B2A4A]">
            Get started with CardPulse
          </h2>
          <p className="mb-6 text-sm text-muted-foreground">
            Upload your first statement to get started
          </p>
          <Link
            href="/upload"
            className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: "#3B82F6" }}
          >
            <Upload className="h-4 w-4" />
            Upload Statement
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5 pb-8">
      {/* Greeting */}
      <p className="text-sm text-muted-foreground">{getGreeting(firstName)}</p>

      {/* Alerts Banner */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className="flex items-start gap-2.5 rounded-xl px-4 py-3"
              style={{ backgroundColor: "rgba(245, 158, 11, 0.1)" }}
            >
              <AlertTriangle
                className="mt-0.5 h-4 w-4 shrink-0"
                style={{ color: "#F59E0B" }}
              />
              <span className="text-[0.8125rem] leading-snug text-amber-700">
                {alert.label}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Net Worth Header */}
      <div className="text-center pt-2">
        <p
          className="text-4xl font-bold tracking-tight tabular-nums text-[#1B2A4A]"
        >
          {formatCurrency(Math.abs(displayAmount), accounts[0]?.currency ?? "GBP")}
        </p>
        {displayAmount < 0 && (
          <div className="mt-1 flex items-center justify-center gap-1">
            <ArrowDownRight className="h-3.5 w-3.5 text-red-500" />
            <span className="text-xs text-red-500">In debt</span>
          </div>
        )}
        <p className="mt-1 text-xs text-muted-foreground uppercase tracking-wider">
          {displayLabel}
        </p>

        {/* Pill Toggle */}
        <div className="mx-auto mt-4 inline-flex rounded-full p-1 bg-gray-100">
          <button
            onClick={() => setViewMode("net-worth")}
            className="rounded-full px-4 py-1.5 text-xs font-medium transition-all"
            style={{
              backgroundColor:
                viewMode === "net-worth" ? "#1B2A4A" : "transparent",
              color: viewMode === "net-worth" ? "#fff" : "#64748B",
            }}
          >
            Net Worth
          </button>
          <button
            onClick={() => setViewMode("debts")}
            className="rounded-full px-4 py-1.5 text-xs font-medium transition-all"
            style={{
              backgroundColor:
                viewMode === "debts" ? "#1B2A4A" : "transparent",
              color: viewMode === "debts" ? "#fff" : "#64748B",
            }}
          >
            Debts &amp; Overdrafts
          </button>
        </div>
      </div>

      {/* Account Groups */}
      <div className="space-y-6 pt-2">
        {sortedGroups.map((cat) => {
          const accts = grouped[cat]
          const groupTotal = accts.reduce((s, a) => s + a.balance, 0)

          return (
            <div key={cat}>
              {/* Group Header */}
              <div className="mb-2.5 flex items-center justify-between px-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {categoryLabel(cat as Account["category"])}
                </span>
                <span className="text-xs font-semibold tabular-nums text-foreground">
                  {formatCurrency(groupTotal, accts[0]?.currency ?? "GBP")}
                </span>
              </div>

              {/* Account Tiles */}
              <div className="space-y-2">
                {accts.map((account) => (
                  <AccountTile key={account.id} account={account} />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Account Tile ───────────────────────────────────────────

function AccountTile({ account }: { account: Account }) {
  const logoUrl = getLogoUrl(account.institutionDomain)
  const initials = getInitials(account.institution)
  const bgColor = getInstitutionColor(account.institution)
  const [imgError, setImgError] = useState(false)

  const showLogo = logoUrl && !imgError

  const utilisation =
    account.category === "credit_card" && account.creditLimit
      ? (Math.abs(account.balance) / account.creditLimit) * 100
      : null

  const utilisationColor =
    utilisation !== null
      ? utilisation >= 90
        ? "#EF4444"
        : utilisation >= 75
          ? "#F59E0B"
          : utilisation >= 50
            ? "#3B82F6"
            : "#22C55E"
      : null

  return (
    <Link
      href={`/accounts/${account.id}`}
      className="flex items-center gap-3.5 rounded-2xl px-4 py-3.5 transition-all active:scale-[0.98] bg-white shadow-sm border border-border"
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

      {/* Name + Last4 */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-semibold text-[#1B2A4A]">
            {account.accountName || account.institution}
          </span>
          {account.last4 && (
            <span className="shrink-0 text-xs text-muted-foreground font-mono">
              ••{account.last4}
            </span>
          )}
        </div>

        {/* Utilisation bar for credit cards */}
        {utilisation !== null && (
          <div className="mt-1.5 flex items-center gap-2">
            <div className="h-1.5 flex-1 rounded-full overflow-hidden bg-gray-100">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.min(utilisation, 100)}%`,
                  backgroundColor: utilisationColor!,
                }}
              />
            </div>
            <span className="shrink-0 text-[0.625rem] tabular-nums text-muted-foreground">
              {Math.round(utilisation)}%
            </span>
          </div>
        )}
      </div>

      {/* Balance */}
      <div className="shrink-0 text-right">
        <span className="text-sm font-semibold tabular-nums text-[#1B2A4A]">
          {formatCurrency(account.balance, account.currency)}
        </span>
      </div>

      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </Link>
  )
}
