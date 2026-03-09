"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import Link from "next/link"
import { Upload, FileText, Check, AlertTriangle, X, Loader2, Clock, ArrowRight } from "lucide-react"
import { useStore } from "@/lib/store"
import { useToast } from "@/components/toast"
import { formatCurrency } from "@/lib/utils"
import type { ParsedStatement } from "@/types"

// ── Types ───────────────────────────────────────────────────
interface FileStatus {
  file: File
  state: "queued" | "uploading" | "parsing" | "parsed" | "confirming" | "done" | "error" | "password-needed"
  error?: string
  parsed?: ParsedStatement
  password?: string
  startedAt?: number
  elapsed?: number
  accountId?: number
  transactionsInserted?: number
  isNew?: boolean
}

type Phase = "drop" | "processing" | "success"

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
  const [dragOver, setDragOver] = useState(false)

  const inputRef = useRef<HTMLInputElement>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const confirmingRef = useRef(false)

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

  // Auto-confirm when all files are parsed — this is the key fix
  useEffect(() => {
    if (phase !== "processing") return
    if (confirmingRef.current) return

    const allResolved = fileStatuses.length > 0 && fileStatuses.every(
      (s) => s.state === "parsed" || s.state === "done" || s.state === "error" || s.state === "confirming"
    )
    if (!allResolved) return

    const parsedStatements = fileStatuses
      .filter((s) => s.state === "parsed" && s.parsed)
      .map((s) => s.parsed!)

    if (parsedStatements.length === 0) return

    // Auto-confirm immediately
    confirmingRef.current = true
    autoConfirm(parsedStatements)
  }, [fileStatuses, phase])

  // ── Auto-confirm parsed statements ──────────────────────────
  const autoConfirm = async (statements: ParsedStatement[]) => {
    // Mark all parsed files as confirming
    setFileStatuses((prev) =>
      prev.map((s) => s.state === "parsed" ? { ...s, state: "confirming" } : s)
    )

    try {
      const res = await fetch("/api/upload/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statements }),
      })

      const data = await res.json()

      if (!res.ok) {
        const errMsg = data.error || "Import failed"
        const details = data.details?.length ? `: ${data.details.join(", ")}` : ""
        console.error("[confirm] Import error:", data)
        setFileStatuses((prev) =>
          prev.map((s) =>
            s.state === "confirming"
              ? { ...s, state: "error", error: `${errMsg}${details}` }
              : s
          )
        )
        confirmingRef.current = false
        return
      }

      // Update file statuses with results
      const results = data.results || []
      setFileStatuses((prev) => {
        const confirmingFiles = prev.filter((s) => s.state === "confirming")
        return prev.map((s) => {
          if (s.state !== "confirming") return s
          const idx = confirmingFiles.indexOf(s)
          const result = results[idx]
          if (!result || result.accountId === 0) {
            return {
              ...s,
              state: "error" as const,
              error: result?.error || "Failed to create account",
            }
          }
          return {
            ...s,
            state: "done" as const,
            accountId: result.accountId,
            transactionsInserted: result.transactionsInserted,
            isNew: !result.existing,
          }
        })
      })

      await refreshAll()

      // Transition to success after a brief moment
      setTimeout(() => setPhase("success"), 600)
    } catch (err) {
      console.error("[confirm] Network error:", err)
      setFileStatuses((prev) =>
        prev.map((s) =>
          s.state === "confirming"
            ? { ...s, state: "error", error: "Network error during import" }
            : s
        )
      )
    } finally {
      confirmingRef.current = false
    }
  }

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

    confirmingRef.current = false
    const statuses: FileStatus[] = valid.map((f) => ({ file: f, state: "queued" }))
    setFileStatuses(statuses)
    setPhase("processing")

    processFilesSequentially(valid)
  }, [toast])

  // ── Process files one at a time ─────────────────────────────
  const processFilesSequentially = async (files: File[]) => {
    for (let i = 0; i < files.length; i++) {
      const file = files[i]

      setFileStatuses((prev) =>
        prev.map((s, j) =>
          j === i ? { ...s, state: "uploading", startedAt: Date.now(), elapsed: 0 } : s
        )
      )

      try {
        const formData = new FormData()
        formData.append("files", file)

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

            // Mark as "parsed" (not "done") — auto-confirm effect will pick this up
            return { ...s, state: "parsed", parsed: match.parsed }
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

    confirmingRef.current = false
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

          return { ...s, state: "parsed", parsed: match.parsed }
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

  const resetAll = () => {
    setPhase("drop")
    setFileStatuses([])
    confirmingRef.current = false
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
  // PROCESSING PHASE (parse + auto-confirm)
  // ═══════════════════════════════════════════════════════════
  if (phase === "processing") {
    const doneCount = fileStatuses.filter((s) => s.state === "done").length
    const errorCount = fileStatuses.filter((s) => s.state === "error").length
    const parsedCount = fileStatuses.filter((s) => s.state === "parsed" || s.state === "confirming" || s.state === "done").length
    const totalCount = fileStatuses.length
    const allResolved = fileStatuses.every(
      (s) => s.state === "done" || s.state === "error"
    )
    const progressPct = totalCount > 0 ? ((doneCount + errorCount) / totalCount) * 100 : 0

    return (
      <div className="px-4 py-6">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-lg font-bold">
            {allResolved ? "Import Complete" : "Processing Files"}
          </h1>
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
            <span>{doneCount} of {totalCount} imported</span>
            {allResolved && doneCount > 0 && (
              <span className="text-green-500">All done</span>
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
                ${status.state === "parsed" || status.state === "confirming"
                  ? "border-primary/20 bg-blue-50" : ""}
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
                    {status.state === "parsed" && status.parsed && (
                      <span className="text-primary/80">
                        Parsed — saving to account...
                      </span>
                    )}
                    {status.state === "confirming" && (
                      <span className="text-primary/80">
                        Creating account &amp; importing transactions...
                      </span>
                    )}
                    {status.state === "done" && status.parsed && (
                      <span className="text-green-500">
                        {status.isNew ? "New account created" : "Account updated"}
                        {status.transactionsInserted ? ` — ${status.transactionsInserted} transaction${status.transactionsInserted !== 1 ? "s" : ""} imported` : ""}
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
                  {(status.state === "uploading" || status.state === "parsing") && (
                    <span className="text-xs text-muted-foreground font-mono flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {status.elapsed || 0}s
                    </span>
                  )}
                  {(status.state === "uploading" || status.state === "parsing" || status.state === "confirming" || status.state === "parsed") && (
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

              {/* Parsed/done: show account summary */}
              {(status.state === "done" || status.state === "parsed" || status.state === "confirming") && status.parsed && (
                <div className="mt-2 pt-2 border-t border-border/50">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-xs font-semibold">{status.parsed.institution}</span>
                    {status.parsed.last4 && (
                      <span className="text-xs text-muted-foreground">****{status.parsed.last4}</span>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
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
                    {status.parsed.transactions.length > 0 && (
                      <div>
                        <span className="text-muted-foreground">Transactions</span>
                        <p className="font-medium">{status.parsed.transactions.length}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {allResolved && doneCount === 0 && (
          <div className="mt-6 text-center space-y-2">
            <p className="text-sm text-muted-foreground">No statements could be imported</p>
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
  const successFiles = fileStatuses.filter((s) => s.state === "done" && s.parsed)
  const totalTx = successFiles.reduce((sum, s) => sum + (s.transactionsInserted || 0), 0)

  return (
    <div className="px-4 py-6">
      <div className="text-center mb-6">
        <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <Check className="w-8 h-8 text-green-500" />
        </div>
        <h1 className="text-lg font-bold mb-1">Import Complete</h1>
        <p className="text-sm text-muted-foreground">
          {successFiles.length} account{successFiles.length !== 1 ? "s" : ""} updated
          {totalTx > 0 && ` with ${totalTx} transaction${totalTx !== 1 ? "s" : ""}`}
        </p>
      </div>

      <div className="space-y-2 mb-6">
        {successFiles.map((s, i) => (
          <div key={i} className="bg-white shadow-sm border border-border rounded-xl p-3.5 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center shrink-0">
              <Check className="w-4 h-4 text-green-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {s.parsed!.institution} {s.parsed!.accountName}
              </p>
              <p className="text-xs text-muted-foreground">
                {s.parsed!.last4 && `****${s.parsed!.last4} · `}
                {s.transactionsInserted || 0} transaction{(s.transactionsInserted || 0) !== 1 ? "s" : ""}
                {s.isNew ? " · New account" : " · Updated"}
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
