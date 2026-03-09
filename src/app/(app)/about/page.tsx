import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Logo } from "@/components/logo"

export default function AboutPage() {
  return (
    <div className="min-h-dvh bg-[#0A1628]">
      <div className="max-w-lg mx-auto px-4 py-6">
        <Link
          href="/settings"
          className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Settings
        </Link>

        <div className="flex flex-col items-center text-center space-y-6 pt-8">
          <Logo size={64} variant="dark" />

          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">CardPulse</h1>
            <p className="text-sm text-blue-400 font-medium mt-1">
              v4.0.0 &quot;Aggregate&quot;
            </p>
          </div>

          <p className="text-sm text-slate-400 max-w-xs leading-relaxed">
            Your financial aggregator. Upload statements, track everything.
          </p>

          <div className="bg-[#111D32] border border-slate-700/50 rounded-xl p-5 w-full max-w-xs space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Built with</span>
              <span className="text-slate-300">Next.js</span>
            </div>
            <div className="h-px bg-slate-700/50" />
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Powered by</span>
              <span className="text-slate-300">AI</span>
            </div>
            <div className="h-px bg-slate-700/50" />
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Version</span>
              <span className="text-slate-300">4.0.0</span>
            </div>
          </div>

          <p className="text-[0.6875rem] text-slate-600 pt-4 pb-20">
            Made with care for your finances.
          </p>
        </div>
      </div>
    </div>
  )
}
