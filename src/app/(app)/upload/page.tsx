"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import Link from "next/link"
import { Upload, FileText, Check, AlertTriangle, X, Loader2, Clock, ArrowRight } from "lucide-react"
import { useStore } from "@/lib/store"
import { useToast } from "@/components/toast"
import { formatCurrency, categoryLabel } from "@/lib/utils"
import { ACCOUNT_CATEGORIES } from "@/types"
import type { ParsedStatement, AccountCategory } from "@/types"

// ── Types ───────────────────────────────────────────────────
interface FileStatus {
  file: File
  state: "queued" | "uploading" | "parsing" | "done" | "error" | "password-needed"
  error?: string
  parsed?: ParsedStatement
  password?: string
  rememberPassword?: boolean
  startedAt?: number
  elapsed?: number
}

interface ReviewStatement {
  filename: string
  parsed: ParsedStatement
  enabled: boolean
}

interface ImportResult {
  institution: string
  accountName: string
  last4: string
  transactionsInserted: number
  isNew: boolean
}

type Phase = "drop" | "processing" | "review" | "success"

const MAX_FILES = 15
const MAX_SIZE_MB = 10
const MAX_SIZE = MAX_SIZE_MB * 1024 * 1024
const ACCEPT = ".pdf,.csv"

function isValidFile(f: File) {
  const ext = f.name.split(".").pop()?.toLowerCase()
  return ext === "pdf" || ext === "csv"
}

const STATUS_MESSAGES = [
  "Uploading to server...",
  "AI is reading your statement...",
  "Extracting account details...",
  "Identifying transactions...",
  "Categorising spending...",
  "Almost there...",
]

function getStatusMessage(elapsed: number): string {
  if (elapsed < 2) return STATUS_MESSAGES[0]
  if (elapsed < 6) return STATUS_MESSAGES[1]
  if (elapsed < 12) return STATUS_MESSAGES[2]
  if (elapsed < 20) return STATUS_MESSAGES[3]
  if (elapsed < 30) return STATUS_MESSAGES[4]
  return STATUS_MESSAGES[5]
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
  const [importResults, setImportResults] = useState<ImportResult[]>([])

  const inputRef = useRef<HTMLInputElement>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Elapsed time ticker for active files
  useEffect(() => {
    if (phase !== "processing") {
      if (timerRef.current) clearInterval(timerRef.current)
      return
    }

    timerRef.current = setInterval(() => {
      setFileStatuses((prev) =>
        prev.map((s) => {
          if ((s.state === "uploading" || s.state === "parsing") && s.startedAt) {
            return { ...s, elapsed: Math.floor((Date.now() - s.startedAt) / 1000) }
          }
          return s
        })
      )
    }, 1000)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [phase])

  // Auto-transition to review when all files resolved
  useEffect(() => {
    if (phase !== "processing") return
    const allResolved = fileStatuses.length > 0 && fileStatuses.every(
      (s) => s.state === "done" || s.state === "error"
    )
    if (!allResolved) return

    const reviewable = fileStatuses
      .filter((s) => s.state === "done" && s.parsed)
      .map((s) => ({
        filename: s.file.name,
        parsed: s.parsed!,
        enabled: true,
      }))

    if (reviewable.length > 0) {
      // Short delay so user sees the final "done" state
      const timeout = setTimeout(() => {
        setReviewStatements(reviewable)
        setPhase("review")
      }, 800)
      return () => clearTimeout(timeout)
    }
  }, [fileStatuses, phase])

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

    const statuses: FileStatus[] = valid.map((f) => ({ file: f, state: "queued" }))
    setFileStatuses(statuses)
    setPhase("processing")

    // Process files one by one so we get per-file progress
    processFilesSequentially(valid)
  }, [toast])

  // ── Process files one at a time ─────────────────────────────
  const processFilesSequentially = async (files: File[]) => {
    for (let i = 0; i < files.length; i++) {
      const file = files[i]

      // Mark this file as uploading
      setFileStatuses((prev) =>
        prev.map((s, j) =>
          j === i ? { ...s, state: "uploading", startedAt: Date.now(), elapsed: 0 } : s
        )
      )

      try {
        const formData = new FormData()
        formData.append("files", file)

        // Mark as parsing
        setFileStatuses((prev) =>
          prev.map((s, j) => (j === i ? { ...s, state: "parsing" } : s))
        )

        const res = await fetch("/api/upload", { method: "POST", body: formData })

        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}))
          setFileStatuses((prev) =>
            prev.map((s, j) =>
              j === i
                ? { ...s, state: "error", error: (errBody as any).error || `Upload failed (${res.status})` }
                : s
            )
          )
          continue
        }

        const { results } = await res.json() as {
          results: Array<{ filename: string; parsed?: ParsedStatement; error?: string }>
        }

        const match = results[0]

        setFileStatuses((prev) =>
          prev.map((s, j) => {
            if (j !== i) return s
            if (!match) return { ...s, state: "error", error: "No response for this file" }

            if (match.error) {
              const isPasswordError =
                match.error.toLowerCase().includes("password") ||
                match.error.toLowerCase().includes("encrypted")
              if (isPasswordError) {
                return { ...s, state: "password-needed", error: match.error }
              }
              return { ...s, state: "error", error: match.error }
            }

            return { ...s, state: "done", parsed: match.parsed }
          })
        )
      } catch {
        setFileStatuses((prev) =>
          prev.map((s, j) =>
            j === i ? { ...s, state: "error", error: "Network error — check your connection" } : s
          )
        )
      }
    }
  }

  // ── Retry single file ────────────────────────────────────
  const retryFile = async (index: number) => {
    const status = fileStatuses[index]
    if (!status) return

    setFileStatuses((prev) =>
      prev.map((s, i) =>
        i === index ? { ...s, state: "uploading", error: undefined, startedAt: Date.now(), elapsed: 0 } : s
      )
    )

    const formData = new FormData()
    formData.append("files", status.file)

    if (status.password) {
      const pwObj: Record<string, string> = { [status.file.name]: status.password }
      formData.append("passwords", JSON.stringify(pwObj))
    }

    try {
      setFileStatuses((prev) =>
        prev.map((s, i) => (i === index ? { ...s, state: "parsing" } : s))
      )

      const res = await fetch("/api/upload", { method: "POST", body: formData })
      if (!res.ok) {
        setFileStatuses((prev) =>
          prev.map((s, i) =>
            i === index ? { ...s, state: "error", error: "Upload failed" } : s
          )
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
          if (!match) return { ...s, state: "error", error: "No response" }

          if (match.error) {
            const isPw =
              match.error.toLowerCase().includes("password") ||
              match.error.toLowerCase().includes("encrypted")
            return isPw
              ? { ...s, state: "password-needed", error: match.error }
              : { ...s, state: "error", error: match.error }
          }

          return { ...s, state: "done", parsed: match.parsed }
        })
      )
    } catch {
      setFileStatuses((prev) =>
        prev.map((s, i) =>
          i === index ? { ...s, state: "error", error: "Network error" } : s
        )
      )
    }
  }

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

      const data = await res.json()
      await refreshAll()

      // Build import results summary
      const summaryResults: ImportResult[] = (data.results || []).map((r: any, idx: number) => ({
        institution: r.institution || confirmed[idx]?.institution || "Unknown",
        accountName: confirmed[idx]?.accountName || "",
        last4: r.last4 || confirmed[idx]?.last4 || "",
        transactionsInserted: r.transactionsInserted || 0,
        isNew: r.accountId !== 0 && !r.existing,
      }))

      setImportResults(summaryResults)
      setPhase("success")
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
    return `${fmt(start)} – ${fmt(end)}`
  }

  const resetAll = () => {
    setPhase("drop")
    setFileStatuses([])
    setReviewStatements([])
    setImportResults([])
  }

  // ═══════════════════════════════════════════════════════════
  // DROP ZONE PHASE
  // ═══════════════════════════════════════════════════════════
  if (phase === "drop") {
    return (
      <div className="px-4 py-6">
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
    const doneCount = fileStatuses.filter((s) => s.state === "done").length
    const errorCount = fileStatuses.filter((s) => s.state === "error").length
    const totalCount = fileStatuses.length
    const hasPasswordNeeded = fileStatuses.some((s) => s.state === "password-needed")
    const allResolved = fileStatuses.every(
      (s) => s.state === "done" || s.state === "error"
    )
    const progressPct = totalCount > 0 ? ((doneCount + errorCount) / totalCount) * 100 : 0

    return (
      <div className="px-4 py-6">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-lg font-bold">Processing Files</h1>
          <button
            onClick={resetAll}
            className="text-muted-foreground hover:text-foreground p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Overall progress bar */}
        <div className="mb-4">
          <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
            <span>{doneCount} of {totalCount} complete</span>
            {!allResolved && <span>{Math.round(progressPct)}%</span>}
            {allResolved && doneCount > 0 && (
              <span className="text-green-400">All done</span>
            )}
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        <div className="space-y-3">
          {fileStatuses.map((status, i) => (
            <div
              key={i}
              className={`
                rounded-xl border p-3.5 transition-all
                ${status.state === "error" ? "border-red-500/30 bg-red-50" : ""}
                ${status.state === "password-needed" ? "border-amber-500/30 bg-amber-50" : ""}
                ${status.state === "done" ? "border-green-500/20 bg-green-50" : ""}
                ${status.state === "uploading" || status.state === "parsing"
                  ? "border-primary/30 bg-blue-50" : ""}
                ${status.state === "queued" ? "border-border/50 opacity-50" : ""}
              `}
            >
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{status.file.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {status.state === "queued" && "Waiting in queue..."}
                    {(status.state === "uploading" || status.state === "parsing") && (
                      <span className="text-primary/80">
                        {getStatusMessage(status.elapsed || 0)}
                      </span>
                    )}
                    {status.state === "done" && status.parsed && (
                      <span className="text-green-400">
                        {status.parsed.institution}
                        {status.parsed.last4 && ` ****${status.parsed.last4}`}
                        {" — "}
                        {status.parsed.transactions.length} transaction{status.parsed.transactions.length !== 1 ? "s" : ""} found
                      </span>
                    )}
                    {status.state === "error" && (
                      <span className="text-red-400">{status.error}</span>
                    )}
                    {status.state === "password-needed" && (
                      <span className="text-amber-400">Password required</span>
                    )}
                  </p>
                </div>
                <div className="shrink-0 flex items-center gap-2">
                  {/* Elapsed timer */}
                  {(status.state === "uploading" || status.state === "parsing") && (
                    <span className="text-xs text-muted-foreground font-mono flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {status.elapsed || 0}s
                    </span>
                  )}
                  {/* State icon */}
                  {(status.state === "uploading" || status.state === "parsing") && (
                    <Loader2 className="w-5 h-5 text-primary animate-spin" />
                  )}
                  {status.state === "queued" && (
                    <div className="w-5 h-5 rounded-full border-2 border-border/50" />
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

              {/* Error retry */}
              {status.state === "error" && (
                <div className="mt-2 flex justify-end">
                  <button
                    onClick={() => retryFile(i)}
                    className="text-xs text-primary hover:underline"
                  >
                    Try again
                  </button>
                </div>
              )}

              {/* Password input */}
              {status.state === "password-needed" && (
                <div className="mt-3 space-y-2">
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
                    className="w-full text-sm bg-background border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <button
                    onClick={() => retryFile(i)}
                    disabled={!status.password}
                    className="w-full text-xs bg-primary text-primary-foreground py-1.5 rounded-lg disabled:opacity-50"
                  >
                    Unlock &amp; Parse
                  </button>
                </div>
              )}

              {/* Done: show parsed summary */}
              {status.state === "done" && status.parsed && (
                <div className="mt-2 pt-2 border-t border-border grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">Balance</span>
                    <p className="font-medium">
                      {formatCurrency(status.parsed.balance, status.parsed.currency)}
                    </p>
                  </div>
                  {status.parsed.creditLimit !== null && (
                    <div>
                      <span className="text-muted-foreground">Limit</span>
                      <p className="font-medium">
                        {formatCurrency(status.parsed.creditLimit, status.parsed.currency)}
                      </p>
                    </div>
                  )}
                  {status.parsed.aprDetected !== null && (
                    <div>
                      <span className="text-muted-foreground">APR</span>
                      <p className="font-medium">{status.parsed.aprDetected}%</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Manual continue button when all resolved */}
        {allResolved && doneCount > 0 && (
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
            className="mt-4 w-full bg-primary text-primary-foreground text-sm font-medium py-3 rounded-xl hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
          >
            Review {doneCount} Statement{doneCount > 1 ? "s" : ""}
            <ArrowRight className="w-4 h-4" />
          </button>
        )}

        {allResolved && doneCount === 0 && (
          <div className="mt-6 text-center space-y-2">
            <p className="text-sm text-muted-foreground">No statements could be parsed</p>
            <button onClick={resetAll} className="text-xs text-primary hover:underline">
              Try different files
            </button>
          </div>
        )}
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════
  // SUCCESS PHASE
  // ═══════════════════════════════════════════════════════════
  if (phase === "success") {
    const totalTx = importResults.reduce((sum, r) => sum + r.transactionsInserted, 0)

    return (
      <div className="px-4 py-6">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-green-500" />
          </div>
          <h1 className="text-lg font-bold mb-1">Import Complete</h1>
          <p className="text-sm text-muted-foreground">
            {importResults.length} account{importResults.length !== 1 ? "s" : ""} updated
            {totalTx > 0 && ` with ${totalTx} transaction${totalTx !== 1 ? "s" : ""}`}
          </p>
        </div>

        <div className="space-y-2 mb-6">
          {importResults.map((r, i) => (
            <div key={i} className="bg-white shadow-sm border border-border rounded-xl p-3.5 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center shrink-0">
                <Check className="w-4 h-4 text-green-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {r.institution} {r.accountName}
                </p>
                <p className="text-xs text-muted-foreground">
                  {r.last4 && `****${r.last4} · `}
                  {r.transactionsInserted} transaction{r.transactionsInserted !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-3">
          <Link
            href="/dashboard"
            className="w-full bg-primary text-primary-foreground text-sm font-medium py-3 rounded-xl hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
          >
            Go to Dashboard
            <ArrowRight className="w-4 h-4" />
          </Link>
          <button
            onClick={resetAll}
            className="w-full text-sm text-muted-foreground py-2 hover:text-foreground transition-colors"
          >
            Upload more statements
          </button>
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════
  // REVIEW PHASE
  // ═══════════════════════════════════════════════════════════
  const enabledCount = reviewStatements.filter((s) => s.enabled).length

  return (
    <div className="px-4 py-6 pb-28">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg font-bold">Review Statements</h1>
          <p className="text-sm text-muted-foreground">
            {reviewStatements.length} statement{reviewStatements.length > 1 ? "s" : ""} parsed &middot;{" "}
            {enabledCount} selected
          </p>
        </div>
        <button
          onClick={resetAll}
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
                    className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform"
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
                </div>

                {/* Statement period */}
                <div>
                  <label className="text-muted-foreground block mb-0.5">Period</label>
                  <p className="font-medium py-0.5">
                    {formatPeriod(p.statementPeriodStart, p.statementPeriodEnd)}
                  </p>
                </div>

                {/* Transactions */}
                <div>
                  <label className="text-muted-foreground block mb-0.5">Transactions</label>
                  <p className="font-medium py-0.5">{p.transactions.length} found</p>
                </div>

                {/* Account type */}
                <div>
                  <label className="text-muted-foreground block mb-0.5">Account Type</label>
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
                        updateReviewField(i, "creditLimit", e.target.value ? parseFloat(e.target.value) : null)
                      }
                      disabled={!stmt.enabled}
                      className="w-full bg-transparent border-b font-medium py-0.5 focus:outline-none focus:border-primary border-border/50"
                    />
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
                        updateReviewField(i, "minimumPayment", e.target.value ? parseFloat(e.target.value) : null)
                      }
                      disabled={!stmt.enabled}
                      className="w-full bg-transparent border-b font-medium py-0.5 focus:outline-none focus:border-primary border-border/50"
                    />
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
                    <input
                      type="number"
                      step="0.1"
                      value={p.aprDetected ?? ""}
                      onChange={(e) =>
                        updateReviewField(i, "aprDetected", e.target.value ? parseFloat(e.target.value) : null)
                      }
                      disabled={!stmt.enabled}
                      className={`
                        w-full bg-transparent border-b font-medium py-0.5
                        focus:outline-none focus:border-primary transition-colors
                        ${isLowConfidence(p, "aprDetected") ? "border-amber-500" : "border-border/50"}
                      `}
                    />
                    {isLowConfidence(p, "aprDetected") && (
                      <span className="text-[0.625rem] text-amber-400">Needs confirmation</span>
                    )}
                  </div>
                )}

                {/* Payment due date */}
                {p.paymentDueDate && (
                  <div>
                    <label className="text-muted-foreground block mb-0.5">Payment Due</label>
                    <p className="font-medium py-0.5">
                      {new Date(p.paymentDueDate).toLocaleDateString("en-GB", {
                        day: "numeric", month: "short", year: "numeric",
                      })}
                    </p>
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
      </div>
    </div>
  )
}
