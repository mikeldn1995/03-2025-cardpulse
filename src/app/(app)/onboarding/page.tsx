"use client"

import { useState, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { ArrowRight, ArrowLeft, Upload, FileText, CheckCircle2, X } from "lucide-react"
import { useStore } from "@/lib/store"
import { Logo } from "@/components/logo"
import { useToast } from "@/components/toast"

type Step = "welcome" | "upload" | "done"

interface UploadedFile {
  name: string
  status: "pending" | "uploading" | "success" | "error"
  accountName?: string
  error?: string
}

export default function OnboardingPage() {
  const { setOnboarded, refreshAll } = useStore()
  const { toast } = useToast()
  const router = useRouter()

  const [step, setStep] = useState<Step>("welcome")
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const currentStepIndex = step === "welcome" ? 0 : step === "upload" ? 1 : 2

  const handleFiles = useCallback(async (selectedFiles: FileList | File[]) => {
    const fileArray = Array.from(selectedFiles)
    if (fileArray.length === 0) return

    const newFiles: UploadedFile[] = fileArray.map((f) => ({
      name: f.name,
      status: "uploading" as const,
    }))
    setFiles((prev) => [...prev, ...newFiles])
    setUploading(true)

    const formData = new FormData()
    fileArray.forEach((f) => formData.append("files", f))

    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData })
      const data = await res.json()

      if (!res.ok) {
        setFiles((prev) =>
          prev.map((f) =>
            newFiles.some((nf) => nf.name === f.name)
              ? { ...f, status: "error" as const, error: data.error || "Upload failed" }
              : f
          )
        )
        toast("Upload failed")
      } else {
        setFiles((prev) =>
          prev.map((f) => {
            if (newFiles.some((nf) => nf.name === f.name)) {
              const parsed = data.results?.find((r: any) => r.fileName === f.name)
              return {
                ...f,
                status: "success" as const,
                accountName: parsed?.accountName || parsed?.institution || "Account",
              }
            }
            return f
          })
        )
        toast(`${fileArray.length} file${fileArray.length > 1 ? "s" : ""} uploaded`)
      }
    } catch {
      setFiles((prev) =>
        prev.map((f) =>
          newFiles.some((nf) => nf.name === f.name)
            ? { ...f, status: "error" as const, error: "Network error" }
            : f
        )
      )
      toast("Upload failed")
    } finally {
      setUploading(false)
    }
  }, [toast])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      handleFiles(e.dataTransfer.files)
    },
    [handleFiles]
  )

  const removeFile = (name: string) => {
    setFiles((prev) => prev.filter((f) => f.name !== name))
  }

  const handleFinish = async () => {
    setOnboarded(true)
    await refreshAll()
    router.push("/dashboard")
  }

  const successCount = files.filter((f) => f.status === "success").length

  return (
    <div className="min-h-dvh bg-[#0A1628] flex flex-col">
      {/* Progress dots */}
      <div className="flex items-center justify-center gap-2 pt-8 pb-2">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={`h-2 rounded-full transition-all ${
              i === currentStepIndex
                ? "w-8 bg-blue-500"
                : i < currentStepIndex
                  ? "w-2 bg-blue-500/60"
                  : "w-2 bg-slate-700"
            }`}
          />
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center px-4 py-8">
        {/* Step 1: Welcome */}
        {step === "welcome" && (
          <div className="w-full max-w-sm text-center space-y-8">
            <Logo size={72} variant="dark" className="mx-auto" />
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">
                Welcome to CardPulse
              </h1>
              <p className="text-sm text-slate-400 mt-3 leading-relaxed max-w-xs mx-auto">
                Your personal financial aggregator. Upload bank &amp; credit card
                statements, and let AI do the rest.
              </p>
            </div>
            <button
              onClick={() => setStep("upload")}
              className="w-full flex items-center justify-center gap-2 py-3.5 text-sm font-medium bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-colors"
            >
              Get Started
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Step 2: Upload */}
        {step === "upload" && (
          <div className="w-full max-w-sm space-y-6">
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">
                Upload your statements
              </h2>
              <p className="text-sm text-slate-400 mt-1">
                Drag and drop PDF or CSV statements, or pick files.
              </p>
            </div>

            {/* Drop zone */}
            <div
              onDragOver={(e) => {
                e.preventDefault()
                setDragOver(true)
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`relative flex flex-col items-center justify-center gap-3 py-12 px-4 rounded-xl border-2 border-dashed cursor-pointer transition-colors ${
                dragOver
                  ? "border-blue-500 bg-blue-500/10"
                  : "border-slate-600 bg-[#111D32] hover:border-slate-500"
              }`}
            >
              <Upload
                className={`w-8 h-8 ${dragOver ? "text-blue-400" : "text-slate-500"}`}
              />
              <div className="text-center">
                <p className="text-sm font-medium text-slate-300">
                  Drop files here or tap to browse
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  PDF or CSV statements
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.csv,.PDF,.CSV"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) handleFiles(e.target.files)
                  e.target.value = ""
                }}
              />
            </div>

            {/* File list */}
            {files.length > 0 && (
              <div className="space-y-2">
                {files.map((f) => (
                  <div
                    key={f.name}
                    className="flex items-center gap-3 py-2.5 px-3 bg-[#111D32] border border-slate-700/50 rounded-lg"
                  >
                    <FileText
                      className={`w-4 h-4 shrink-0 ${
                        f.status === "success"
                          ? "text-emerald-400"
                          : f.status === "error"
                            ? "text-red-400"
                            : "text-slate-500"
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-slate-300 truncate">{f.name}</div>
                      {f.status === "uploading" && (
                        <div className="text-xs text-slate-500">Processing...</div>
                      )}
                      {f.status === "success" && f.accountName && (
                        <div className="text-xs text-emerald-400">{f.accountName}</div>
                      )}
                      {f.status === "error" && (
                        <div className="text-xs text-red-400">{f.error}</div>
                      )}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        removeFile(f.name)
                      }}
                      className="text-slate-600 hover:text-slate-400"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Navigation */}
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setStep("welcome")}
                className="flex items-center gap-1.5 py-3 px-4 text-sm text-slate-400 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
              <div className="flex-1" />
              {files.some((f) => f.status === "success") ? (
                <button
                  onClick={() => setStep("done")}
                  className="flex items-center gap-2 py-3 px-6 text-sm font-medium bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-colors"
                >
                  Continue
                  <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={() => setStep("done")}
                  className="text-sm text-slate-500 hover:text-slate-300 transition-colors"
                >
                  Skip for now
                </button>
              )}
            </div>
          </div>
        )}

        {/* Step 3: Done */}
        {step === "done" && (
          <div className="w-full max-w-sm text-center space-y-8">
            <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white tracking-tight">
                You&apos;re all set!
              </h2>
              <p className="text-sm text-slate-400 mt-3 leading-relaxed">
                {successCount > 0
                  ? `${successCount} statement${successCount > 1 ? "s" : ""} imported successfully. Your accounts are ready to explore.`
                  : "You can upload statements anytime from the Upload page."}
              </p>
            </div>
            <button
              onClick={handleFinish}
              className="w-full flex items-center justify-center gap-2 py-3.5 text-sm font-medium bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-colors"
            >
              Go to Dashboard
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
