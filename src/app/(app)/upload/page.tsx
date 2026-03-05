"use client"

import { useState, useRef } from "react"
import { Upload, FileText, CheckCircle2, Loader2, AlertCircle } from "lucide-react"
import { useStore } from "@/lib/store"
import { useToast } from "@/components/toast"
import { cn, getBalance, getEffectiveAPR, currentMonth } from "@/lib/utils"

interface FileItem {
  name: string
  size: number
  status: "queued" | "parsing" | "done" | "error"
  message?: string
}

export default function UploadPage() {
  const { cards, upsertStatement } = useStore()
  const { toast } = useToast()
  const [files, setFiles] = useState<FileItem[]>([])
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const processFile = (file: File) => {
    const item: FileItem = { name: file.name, size: file.size, status: "queued" }
    setFiles(prev => [...prev, item])

    // Simulate AI parsing
    setTimeout(() => {
      setFiles(prev => prev.map(f => f.name === file.name ? { ...f, status: "parsing" } : f))

      setTimeout(() => {
        const isPdf = file.name.toLowerCase().endsWith(".pdf")
        if (!isPdf) {
          setFiles(prev => prev.map(f =>
            f.name === file.name ? { ...f, status: "error", message: "Not a PDF statement" } : f
          ))
          return
        }

        if (cards.length > 0) {
          const card = cards[Math.floor(Math.random() * cards.length)]
          const month = currentMonth()
          const spent = Math.round((200 + Math.random() * 500) * 100) / 100
          const paid = Math.round((100 + Math.random() * 300) * 100) / 100
          const bal = getBalance(card)
          const interest = Math.round(bal * (getEffectiveAPR(card) / 100 / 12) * 100) / 100
          upsertStatement(card.id, { month, spent, paid, interest, source: "upload" })
          setFiles(prev => prev.map(f =>
            f.name === file.name
              ? { ...f, status: "done", message: `Updated ${card.issuer} •••• ${card.last4} — ${month} statement` }
              : f
          ))
          toast(`Parsed: ${card.issuer} statement added`)
        } else {
          setFiles(prev => prev.map(f =>
            f.name === file.name ? { ...f, status: "error", message: "No cards to match" } : f
          ))
        }
      }, 1500 + Math.random() * 1000)
    }, 500)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    Array.from(e.dataTransfer.files).forEach(processFile)
  }

  const handleSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      Array.from(e.target.files).forEach(processFile)
      e.target.value = ""
    }
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1048576).toFixed(1)} MB`
  }

  return (
    <>
      <div className="pb-3">
        <p className="text-[0.8125rem] text-muted-foreground">Import PDF statements to auto-update balances</p>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "border-2 border-dashed rounded-lg p-8 flex flex-col items-center gap-3 cursor-pointer transition-colors",
          dragOver ? "border-ring bg-accent/50" : "border-border hover:border-ring/50"
        )}
      >
        <div className={cn(
          "w-12 h-12 rounded-full flex items-center justify-center transition-colors",
          dragOver ? "bg-foreground/10" : "bg-secondary"
        )}>
          <Upload className="w-5 h-5 text-muted-foreground" />
        </div>
        <div className="text-center">
          <div className="text-sm font-medium">Drop PDF statements here</div>
          <div className="text-xs text-muted-foreground mt-0.5">or tap to browse</div>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf"
          multiple
          onChange={handleSelect}
          className="hidden"
        />
      </div>

      {/* File queue */}
      {files.length > 0 && (
        <div className="mt-4 space-y-2">
          <div className="text-[0.6875rem] uppercase tracking-wider text-muted-foreground font-medium">
            Processing Queue
          </div>
          {files.map((f, i) => (
            <div key={i} className="bg-card border border-border rounded-lg px-3 py-2.5 flex items-center gap-3">
              <div className={cn(
                "w-8 h-8 rounded-md flex items-center justify-center shrink-0",
                f.status === "done" ? "bg-success/10" : f.status === "error" ? "bg-destructive/10" : "bg-secondary"
              )}>
                {f.status === "parsing" && <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />}
                {f.status === "queued" && <FileText className="w-4 h-4 text-muted-foreground" />}
                {f.status === "done" && <CheckCircle2 className="w-4 h-4 text-success" />}
                {f.status === "error" && <AlertCircle className="w-4 h-4 text-destructive" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">{f.name}</div>
                <div className="text-xs text-muted-foreground">
                  {f.status === "queued" && `${formatSize(f.size)} — Queued`}
                  {f.status === "parsing" && "Parsing statement..."}
                  {f.status === "done" && f.message}
                  {f.status === "error" && f.message}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Instructions */}
      <div className="mt-6 bg-secondary/50 rounded-lg p-4">
        <div className="text-xs font-medium mb-2">How it works</div>
        <div className="space-y-1.5 text-xs text-muted-foreground">
          <div className="flex gap-2"><span className="font-mono text-foreground/60">1.</span> Upload your bank or credit card PDF statement</div>
          <div className="flex gap-2"><span className="font-mono text-foreground/60">2.</span> AI identifies the card and extracts the balance</div>
          <div className="flex gap-2"><span className="font-mono text-foreground/60">3.</span> Your card data is automatically updated</div>
        </div>
        <div className="mt-3 text-[0.6875rem] text-muted-foreground/80 italic">
          Demo mode — files are simulated. Real parsing requires API integration.
        </div>
      </div>
    </>
  )
}
