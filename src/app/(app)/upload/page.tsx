"use client"

import { useState, useRef, useCallback } from "react"
import Link from "next/link"
import { Upload, FileText, Check, AlertTriangle, X, Loader2 } from "lucide-react"
import { useStore } from "@/lib/store"
import { useToast } from "@/components/toast"
import { formatCurrency, categoryLabel } from "@/lib/utils"
import { ACCOUNT_CATEGORIES } from "@/types"
import type { ParsedStatement, AccountCategory } from "@/types"

// ── Types ───────────────────────────────────────────────────
interface FileStatus {
  file: File
  state: "pending" | "uploading" | "parsing" | "done" | "error" | "password-needed"
  error?: string
  parsed?: ParsedStatement
  password?: string
  rememberPassword?: boolean
}

interface ReviewStatement {
  filename: string
  parsed: ParsedStatement
  enabled: boolean
}

type Phase = "drop" | "processing" | "review"

const MAX_FILES = 15
const MAX_SIZE_MB = 10
const MAX_SIZE = MAX_SIZE_MB * 1024 * 1024
const ACCEPT = ".pdf,.csv"
const ACCEPT_TYPES = [
  "application/pdf",
  "text/csv",
  "application/vnd.ms-excel",
]

function isValidFile(f: File) {
  const ext = f.name.split(".").pop()?.toLowerCase()
  return ext === "pdf" || ext === "csv"
}

// ── Component ───────────────────────────────────────────────
export default function UploadPage() {
  const { refreshAll, baseCurrency } = useStore()
  const { toast } = useToast()

  const [phase, setPhase] = useState<Phase>("drop")
  const [fileStatuses, setFileStatuses] = useState<FileStatus[]>([])
  const [reviewStatements, setReviewStatements] = useState<ReviewStatement[]>([])
  const [confirming, setConfirming] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  const inputRef = useRef<HTMLInputElement>(null)

  // ── File selection ────────────────────────────────────────
  const handleFiles = useCallback((fileList: FileList | File[]) => {
    const files = Array.from(fileList)
    const valid = files.filter(isValidFile)

    if (valid.length === 0) {
      toast("Please select PDF or CSV files")
      return
    }
    if (valid.length > MAX_FILES) {
      toast(`Maximum ${MAX_FILES} files allowed`)
      return
    }

    const oversized = valid.filter((f) => f.size > MAX_SIZE)
    if (oversized.length > 0) {
      toast(`${oversized.length} file${oversized.length > 1 ? "s" : ""} exceed ${MAX_SIZE_MB}MB limit`)
      return
    }

    const statuses: FileStatus[] = valid.map((f) => ({ file: f, state: "pending" }))
    setFileStatuses(statuses)
    setPhase("processing")
    uploadFiles(valid, statuses)
  }, [toast])

  // ── Upload ────────────────────────────────────────────────
  const uploadFiles = async (files: File[], statuses: FileStatus[], passwords?: Map<string, string>) => {
    // Mark all as uploading
    setFileStatuses(statuses.map((s) => ({ ...s, state: "uploading" })))

    const formData = new FormData()
    files.forEach((f) => formData.append("files", f))

    // Attach passwords if any
    if (passwords && passwords.size > 0) {
      const pwObj: Record<string, string> = {}
      passwords.forEach((v, k) => { pwObj[k] = v })
      formData.append("passwords", JSON.stringify(pwObj))
    }

    // Mark as parsing
    setFileStatuses((prev) => prev.map((s) => ({ ...s, state: "parsing" })))

    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData })

      if (!res.ok) {
        setFileStatuses((prev) => prev.map((s) => ({ ...s, state: "error", error: "Upload failed" })))
        return
      }

      const { results } = await res.json() as {
        results: Array<{ filename: string; parsed?: ParsedStatement; error?: string }>
      }

      const updated: FileStatus[] = statuses.map((s) => {
        const match = results.find((r) => r.filename === s.file.name)
        if (!match) return { ...s, state: "error" as const, error: "No response for this file" }

        if (match.error) {
          const isPasswordError =
            match.error.toLowerCase().includes("password") ||
            match.error.toLowerCase().includes("encrypted")
          if (isPasswordError) {
            return { ...s, state: "password-needed" as const, error: match.error }
          }
          return { ...s, state: "error" as const, error: match.error }
        }

        return { ...s, state: "done" as const, parsed: match.parsed }
      })

      setFileStatuses(updated)

      // If all done (no password-needed), move to review
      const allResolved = updated.every((s) => s.state === "done" || s.state === "error")
      if (allResolved) {
        const reviewable = updated
          .filter((s) => s.state === "done" && s.parsed)
          .map((s) => ({
            filename: s.file.name,
            parsed: s.parsed!,
            enabled: true,
          }))

        if (reviewable.length > 0) {
          setReviewStatements(reviewable)
          setPhase("review")
        }
      }
    } catch {
      setFileStatuses((prev) => prev.map((s) => ({ ...s, state: "error", error: "Network error" })))
    }
  }

  // ── Retry single file ────────────────────────────────────
  const retryFile = async (index: number) => {
    const status = fileStatuses[index]
    if (!status) return

    const passwords = new Map<string, string>()
    if (status.password) passwords.set(status.file.name, status.password)

    setFileStatuses((prev) =>
      prev.map((s, i) => (i === index ? { ...s, state: "uploading", error: undefined } : s))
    )

    const formData = new FormData()
    formData.append("files", status.file)
    if (passwords.size > 0) {
      const pwObj: Record<string, string> = {}
      passwords.forEach((v, k) => { pwObj[k] = v })
      formData.append("passwords", JSON.stringify(pwObj))
    }

    try {
      setFileStatuses((prev) =>
        prev.map((s, i) => (i === index ? { ...s, state: "parsing" } : s))
      )

      const res = await fetch("/api/upload", { method: "POST", body: formData })
      if (!res.ok) {
        setFileStatuses((prev) =>
          prev.map((s, i) => (i === index ? { ...s, state: "error", error: "Upload failed" } : s))
        )
        return
      }

      const { results } = await res.json() as {
        results: Array<{ filename: string; parsed?: ParsedStatement; error?: string }>
      }

      setFileStatuses((prev) =>
        prev.map((s, i) => {
          if (i !== index) return s
          const match = results.find((r) => r.filename === status.file.name)
          if (!match) return { ...s, state: "error" as const, error: "No response" }

          if (match.error) {
            const isPw =
              match.error.toLowerCase().includes("password") ||
              match.error.toLowerCase().includes("encrypted")
            return isPw
              ? { ...s, state: "password-needed" as const, error: match.error }
              : { ...s, state: "error" as const, error: match.error }
          }

          return { ...s, state: "done" as const, parsed: match.parsed }
        })
      )
    } catch {
      setFileStatuses((prev) =>
        prev.map((s, i) => (i === index ? { ...s, state: "error", error: "Network error" } : s))
      )
    }
  }

  // ── Submit passwords and continue ─────────────────────────
  const submitPasswords = () => {
    const passwords = new Map<string, string>()
    fileStatuses.forEach((s) => {
      if (s.state === "password-needed" && s.password) {
        passwords.set(s.file.name, s.password)
      }
    })

    const needingRetry = fileStatuses.filter(
      (s) => s.state === "password-needed" && s.password
    )
    if (needingRetry.length === 0) return

    // Retry the password-protected files
    needingRetry.forEach((s) => {
      const idx = fileStatuses.indexOf(s)
      if (idx >= 0) retryFile(idx)
    })
  }

  // Check if processing is done and we can move to review
  const checkMoveToReview = useCallback(() => {
    const allResolved = fileStatuses.every(
      (s) => s.state === "done" || s.state === "error"
    )
    if (allResolved) {
      const reviewable = fileStatuses
        .filter((s) => s.state === "done" && s.parsed)
        .map((s) => ({
          filename: s.file.name,
          parsed: s.parsed!,
          enabled: true,
        }))
      if (reviewable.length > 0) {
        setReviewStatements(reviewable)
        setPhase("review")
      }
    }
  }, [fileStatuses])

  // ── Inline edit for review ────────────────────────────────
  const updateReviewField = (
    index: number,
    field: keyof ParsedStatement,
    value: string | number | null
  ) => {
    setReviewStatements((prev) =>
      prev.map((s, i) =>
        i === index ? { ...s, parsed: { ...s.parsed, [field]: value } } : s
      )
    )
  }

  const toggleStatement = (index: number) => {
    setReviewStatements((prev) =>
      prev.map((s, i) => (i === index ? { ...s, enabled: !s.enabled } : s))
    )
  }

  // ── Confirm import ────────────────────────────────────────
  const confirmImport = async () => {
    const confirmed = reviewStatements
      .filter((s) => s.enabled)
      .map((s) => s.parsed)

    if (confirmed.length === 0) {
      toast("No statements selected for import")
      return
    }

    setConfirming(true)

    try {
      const res = await fetch("/api/upload/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statements: confirmed }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast((err as { error?: string }).error || "Import failed")
        setConfirming(false)
        return
      }

      await refreshAll()
      toast(`${confirmed.length} statement${confirmed.length > 1 ? "s" : ""} imported successfully`)
      setPhase("drop")
      setFileStatuses([])
      setReviewStatements([])
    } catch {
      toast("Network error during import")
    } finally {
      setConfirming(false)
    }
  }

  // ── Drag & Drop handlers ─────────────────────────────────
  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }
  const onDragLeave = () => setDragOver(false)
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files)
  }

  // ── Helpers ───────────────────────────────────────────────
  const isLowConfidence = (parsed: ParsedStatement, field: string) => {
    return parsed.confidence?.[field] !== undefined && parsed.confidence[field] < 0.7
  }

  const formatPeriod = (start: string | null, end: string | null) => {
    if (!start || !end) return "Unknown period"
    const fmt = (d: string) =>
      new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
    return `${fmt(start)} - ${fmt(end)}`
  }

  // ═══════════════════════════════════════════════════════════
  // DROP ZONE PHASE
  // ═══════════════════════════════════════════════════════════
  if (phase === "drop") {
    return (
      <div className="min-h-screen px-4 py-6">
        <h1 className="text-lg font-bold mb-1">Upload Statements</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Import credit card or bank statements to keep your accounts up to date.
        </p>

        {/* Drop zone */}
        <div
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          className={`
            border-2 border-dashed rounded-xl p-10 text-center cursor-pointer
            transition-colors duration-200
            ${dragOver
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/50 hover:bg-primary/5"
            }
          `}
        >
          <Upload className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
          <p className="text-sm font-medium mb-1">
            Drop files here or tap to browse
          </p>
          <p className="text-xs text-muted-foreground">
            PDF or CSV &middot; up to {MAX_FILES} files &middot; {MAX_SIZE_MB}MB each
          </p>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) handleFiles(e.target.files)
            e.target.value = ""
          }}
        />

        <div className="mt-6 text-center">
          <Link href="/accounts" className="text-xs text-muted-foreground hover:text-primary transition-colors">
            Or enter data manually
          </Link>
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════
  // PROCESSING PHASE
  // ═══════════════════════════════════════════════════════════
  if (phase === "processing") {
    const hasPasswordNeeded = fileStatuses.some((s) => s.state === "password-needed")
    const allResolved = fileStatuses.every(
      (s) => s.state === "done" || s.state === "error"
    )
    const successCount = fileStatuses.filter((s) => s.state === "done").length

    return (
      <div className="min-h-screen px-4 py-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-lg font-bold">Processing Files</h1>
          <button
            onClick={() => { setPhase("drop"); setFileStatuses([]) }}
            className="text-muted-foreground hover:text-foreground p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3">
          {fileStatuses.map((status, i) => (
            <div
              key={i}
              className={`
                rounded-lg border p-3 transition-colors
                ${status.state === "error" ? "border-red-500/50 bg-red-500/5" : ""}
                ${status.state === "password-needed" ? "border-amber-500/50 bg-amber-500/5" : ""}
                ${status.state === "done" ? "border-green-500/30 bg-green-500/5" : ""}
                ${status.state === "uploading" || status.state === "parsing" || status.state === "pending"
                  ? "border-border" : ""}
              `}
            >
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{status.file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(status.file.size / 1024).toFixed(0)} KB
                  </p>
                </div>
                <div className="shrink-0">
                  {(status.state === "uploading" || status.state === "parsing" || status.state === "pending") && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="capitalize">{status.state === "pending" ? "Waiting" : status.state}...</span>
                    </div>
                  )}
                  {status.state === "done" && (
                    <Check className="w-5 h-5 text-green-500" />
                  )}
                  {status.state === "error" && (
                    <AlertTriangle className="w-5 h-5 text-red-500" />
                  )}
                  {status.state === "password-needed" && (
                    <AlertTriangle className="w-5 h-5 text-amber-500" />
                  )}
                </div>
              </div>

              {/* Error message + retry */}
              {status.state === "error" && status.error && (
                <div className="mt-2 flex items-center justify-between">
                  <p className="text-xs text-red-400">{status.error}</p>
                  <button
                    onClick={() => retryFile(i)}
                    className="text-xs text-primary hover:underline shrink-0 ml-2"
                  >
                    Try again
                  </button>
                </div>
              )}

              {/* Password input */}
              {status.state === "password-needed" && (
                <div className="mt-3 space-y-2">
                  <p className="text-xs text-amber-400">
                    This PDF is password-protected
                  </p>
                  <input
                    type="password"
                    placeholder="Enter PDF password"
                    value={status.password || ""}
                    onChange={(e) =>
                      setFileStatuses((prev) =>
                        prev.map((s, j) =>
                          j === i ? { ...s, password: e.target.value } : s
                        )
                      )
                    }
                    className="w-full text-sm bg-background border border-border rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={status.rememberPassword || false}
                      onChange={(e) =>
                        setFileStatuses((prev) =>
                          prev.map((s, j) =>
                            j === i ? { ...s, rememberPassword: e.target.checked } : s
                          )
                        )
                      }
                      className="rounded border-border"
                    />
                    Remember password for {status.parsed?.institution || "this institution"}
                  </label>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Password submit button */}
        {hasPasswordNeeded && (
          <button
            onClick={submitPasswords}
            className="mt-4 w-full bg-primary text-primary-foreground text-sm font-medium py-2.5 rounded-lg hover:bg-primary/90 transition-colors"
          >
            Unlock &amp; Continue
          </button>
        )}

        {/* Move to review when all resolved */}
        {allResolved && successCount > 0 && (
          <button
            onClick={() => {
              const reviewable = fileStatuses
                .filter((s) => s.state === "done" && s.parsed)
                .map((s) => ({
                  filename: s.file.name,
                  parsed: s.parsed!,
                  enabled: true,
                }))
              setReviewStatements(reviewable)
              setPhase("review")
            }}
            className="mt-4 w-full bg-primary text-primary-foreground text-sm font-medium py-2.5 rounded-lg hover:bg-primary/90 transition-colors"
          >
            Review {successCount} Statement{successCount > 1 ? "s" : ""}
          </button>
        )}

        {allResolved && successCount === 0 && (
          <div className="mt-6 text-center space-y-2">
            <p className="text-sm text-muted-foreground">No statements could be parsed</p>
            <Link
              href="/accounts"
              className="text-xs text-primary hover:underline"
            >
              Enter data manually instead
            </Link>
          </div>
        )}
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════
  // REVIEW PHASE
  // ═══════════════════════════════════════════════════════════
  const enabledCount = reviewStatements.filter((s) => s.enabled).length

  return (
    <div className="min-h-screen px-4 py-6 pb-28">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg font-bold">Review Statements</h1>
          <p className="text-sm text-muted-foreground">
            {reviewStatements.length} statement{reviewStatements.length > 1 ? "s" : ""} parsed &middot;{" "}
            {enabledCount} selected
          </p>
        </div>
        <button
          onClick={() => { setPhase("drop"); setFileStatuses([]); setReviewStatements([]) }}
          className="text-muted-foreground hover:text-foreground p-1"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Statement cards */}
      <div className="space-y-4 overflow-y-auto">
        {reviewStatements.map((stmt, i) => {
          const p = stmt.parsed
          const catLabel =
            ACCOUNT_CATEGORIES.find((c) => c.value === p.category)?.label || p.category

          return (
            <div
              key={i}
              className={`
                rounded-xl border p-4 transition-all
                ${stmt.enabled ? "border-border" : "border-border/30 opacity-50"}
              `}
            >
              {/* Header: institution + toggle */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold truncate">
                      {p.institution}
                    </h3>
                    {isLowConfidence(p, "institution") && (
                      <span className="text-[0.625rem] bg-amber-500/15 text-amber-400 px-1.5 py-0.5 rounded font-medium shrink-0">
                        Needs confirmation
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {catLabel}
                    {p.last4 && ` ending ${p.last4}`}
                  </p>
                </div>

                {/* Toggle switch */}
                <button
                  onClick={() => toggleStatement(i)}
                  className={`
                    relative w-10 h-5 rounded-full shrink-0 ml-3 transition-colors
                    ${stmt.enabled ? "bg-primary" : "bg-muted"}
                  `}
                >
                  <span
                    className={`
                      absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform
                      ${stmt.enabled ? "left-5.5 translate-x-0" : "left-0.5"}
                    `}
                    style={stmt.enabled ? { left: "1.375rem" } : { left: "0.125rem" }}
                  />
                </button>
              </div>

              {/* Filename */}
              <p className="text-[0.6875rem] text-muted-foreground mb-3 flex items-center gap-1">
                <FileText className="w-3 h-3" />
                {stmt.filename}
              </p>

              {/* Fields grid */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-xs">
                {/* Balance */}
                <div>
                  <label className="text-muted-foreground block mb-0.5">Balance</label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      step="0.01"
                      value={p.balance}
                      onChange={(e) =>
                        updateReviewField(i, "balance", parseFloat(e.target.value) || 0)
                      }
                      disabled={!stmt.enabled}
                      className={`
                        w-full bg-transparent border-b font-medium py-0.5
                        focus:outline-none focus:border-primary transition-colors
                        ${isLowConfidence(p, "balance") ? "border-amber-500" : "border-border/50"}
                      `}
                    />
                    {isLowConfidence(p, "balance") && (
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    )}
                  </div>
                  {isLowConfidence(p, "balance") && (
                    <span className="text-[0.625rem] text-amber-400">Needs confirmation</span>
                  )}
                </div>

                {/* Statement period */}
                <div>
                  <label className="text-muted-foreground block mb-0.5">Period</label>
                  <p className={`
                    font-medium py-0.5
                    ${isLowConfidence(p, "statementPeriodStart") || isLowConfidence(p, "statementPeriodEnd")
                      ? "text-amber-400" : ""}
                  `}>
                    {formatPeriod(p.statementPeriodStart, p.statementPeriodEnd)}
                  </p>
                  {(isLowConfidence(p, "statementPeriodStart") || isLowConfidence(p, "statementPeriodEnd")) && (
                    <span className="text-[0.625rem] text-amber-400">Needs confirmation</span>
                  )}
                </div>

                {/* Transactions */}
                <div>
                  <label className="text-muted-foreground block mb-0.5">Transactions</label>
                  <p className="font-medium py-0.5">{p.transactions.length} found</p>
                </div>

                {/* Account type */}
                <div>
                  <label className="text-muted-foreground block mb-0.5">Account Type</label>
                  <div className="flex items-center gap-1">
                    <select
                      value={p.category}
                      onChange={(e) =>
                        updateReviewField(i, "category", e.target.value as AccountCategory)
                      }
                      disabled={!stmt.enabled}
                      className={`
                        bg-transparent border-b py-0.5 font-medium w-full
                        focus:outline-none focus:border-primary transition-colors
                        ${isLowConfidence(p, "category") ? "border-amber-500" : "border-border/50"}
                      `}
                    >
                      {ACCOUNT_CATEGORIES.map((c) => (
                        <option key={c.value} value={c.value} className="bg-background text-foreground">
                          {c.label}
                        </option>
                      ))}
                    </select>
                    {isLowConfidence(p, "category") && (
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    )}
                  </div>
                  {isLowConfidence(p, "category") && (
                    <span className="text-[0.625rem] text-amber-400">Needs confirmation</span>
                  )}
                </div>

                {/* Credit limit */}
                {p.creditLimit !== null && (
                  <div>
                    <label className="text-muted-foreground block mb-0.5">Credit Limit</label>
                    <input
                      type="number"
                      step="0.01"
                      value={p.creditLimit ?? ""}
                      onChange={(e) =>
                        updateReviewField(
                          i,
                          "creditLimit",
                          e.target.value ? parseFloat(e.target.value) : null
                        )
                      }
                      disabled={!stmt.enabled}
                      className={`
                        w-full bg-transparent border-b font-medium py-0.5
                        focus:outline-none focus:border-primary transition-colors
                        ${isLowConfidence(p, "creditLimit") ? "border-amber-500" : "border-border/50"}
                      `}
                    />
                    {isLowConfidence(p, "creditLimit") && (
                      <span className="text-[0.625rem] text-amber-400">Needs confirmation</span>
                    )}
                  </div>
                )}

                {/* Minimum payment */}
                {p.minimumPayment !== null && (
                  <div>
                    <label className="text-muted-foreground block mb-0.5">Min Payment</label>
                    <input
                      type="number"
                      step="0.01"
                      value={p.minimumPayment ?? ""}
                      onChange={(e) =>
                        updateReviewField(
                          i,
                          "minimumPayment",
                          e.target.value ? parseFloat(e.target.value) : null
                        )
                      }
                      disabled={!stmt.enabled}
                      className={`
                        w-full bg-transparent border-b font-medium py-0.5
                        focus:outline-none focus:border-primary transition-colors
                        ${isLowConfidence(p, "minimumPayment") ? "border-amber-500" : "border-border/50"}
                      `}
                    />
                    {isLowConfidence(p, "minimumPayment") && (
                      <span className="text-[0.625rem] text-amber-400">Needs confirmation</span>
                    )}
                  </div>
                )}

                {/* Interest charged */}
                {p.interestCharged !== null && (
                  <div>
                    <label className="text-muted-foreground block mb-0.5">Interest Charged</label>
                    <p className="font-medium py-0.5">
                      {formatCurrency(p.interestCharged ?? 0, baseCurrency)}
                    </p>
                  </div>
                )}

                {/* APR */}
                {p.aprDetected !== null && (
                  <div>
                    <label className="text-muted-foreground block mb-0.5">APR Detected</label>
                    <p className={`
                      font-medium py-0.5
                      ${isLowConfidence(p, "aprDetected") ? "text-amber-400" : ""}
                    `}>
                      {p.aprDetected}%
                    </p>
                    {isLowConfidence(p, "aprDetected") && (
                      <span className="text-[0.625rem] text-amber-400">Needs confirmation</span>
                    )}
                  </div>
                )}
              </div>

              {/* Institution name edit */}
              <div className="mt-3 pt-3 border-t border-border/30">
                <label className="text-xs text-muted-foreground block mb-1">Institution Name</label>
                <input
                  type="text"
                  value={p.institution}
                  onChange={(e) => updateReviewField(i, "institution", e.target.value)}
                  disabled={!stmt.enabled}
                  className="w-full text-sm bg-transparent border-b border-border/50 py-0.5 font-medium focus:outline-none focus:border-primary transition-colors"
                />
              </div>

              {/* Account name edit */}
              <div className="mt-2">
                <label className="text-xs text-muted-foreground block mb-1">Account Name</label>
                <input
                  type="text"
                  value={p.accountName}
                  onChange={(e) => updateReviewField(i, "accountName", e.target.value)}
                  disabled={!stmt.enabled}
                  className="w-full text-sm bg-transparent border-b border-border/50 py-0.5 font-medium focus:outline-none focus:border-primary transition-colors"
                />
              </div>
            </div>
          )
        })}
      </div>

      {/* Sticky bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/95 backdrop-blur border-t border-border">
        <button
          onClick={confirmImport}
          disabled={confirming || enabledCount === 0}
          className={`
            w-full text-sm font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2
            ${enabledCount === 0
              ? "bg-muted text-muted-foreground cursor-not-allowed"
              : "bg-primary text-primary-foreground hover:bg-primary/90"
            }
          `}
        >
          {confirming ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Importing...
            </>
          ) : (
            <>
              <Check className="w-4 h-4" />
              Import {enabledCount} Statement{enabledCount !== 1 ? "s" : ""}
            </>
          )}
        </button>

        <div className="text-center mt-2">
          <Link href="/accounts" className="text-xs text-muted-foreground hover:text-primary transition-colors">
            Enter data manually instead
          </Link>
        </div>
      </div>
    </div>
  )
}
