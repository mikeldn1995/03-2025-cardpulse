import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Logo } from "@/components/logo"

export default function AboutPage() {
  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <Link
        href="/menu"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
      >
        <ArrowLeft className="w-4 h-4" />
        Menu
      </Link>

      <div className="flex flex-col items-center text-center space-y-6 pt-4">
        <Logo size={64} />

        <div>
          <h1 className="text-2xl font-bold text-[#1B2A4A] tracking-tight">CardPulse</h1>
          <p className="text-sm text-primary font-medium mt-1">
            v4.0.0 &quot;Aggregate&quot;
          </p>
        </div>

        <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
          Your personal financial aggregator. Upload statements, track balances, forecast payoffs, and take control of your money.
        </p>

        <div className="bg-white shadow-sm border border-border rounded-xl p-5 w-full max-w-xs space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Built with</span>
            <span className="text-foreground">Next.js &amp; AI</span>
          </div>
          <div className="h-px bg-border" />
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">AI Engine</span>
            <span className="text-foreground">GPT-4o</span>
          </div>
          <div className="h-px bg-border" />
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Version</span>
            <span className="text-foreground">4.0.0</span>
          </div>
        </div>
      </div>

      {/* Legal / Disclaimer */}
      <div className="mt-10 space-y-4 text-[0.6875rem] text-muted-foreground leading-relaxed px-2">
        <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">
          Important Information
        </h3>

        <p>
          CardPulse is a personal financial management tool designed to help you organise
          and visualise your financial data. CardPulse is not a bank, financial adviser,
          or regulated financial services provider. Nothing in this application constitutes
          financial advice, and you should always consult a qualified financial adviser before
          making financial decisions.
        </p>

        <p>
          The information displayed in CardPulse is derived from statements and data you
          provide. While we use AI-powered parsing to extract data as accurately as possible,
          we cannot guarantee the accuracy, completeness, or timeliness of any information
          presented. You are solely responsible for verifying the accuracy of all data,
          balances, and transactions shown within the application.
        </p>

        <p>
          Forecasts, payoff projections, and financial health scores are estimates based on
          simplified models and the data available at the time of calculation. Actual results
          may differ materially due to changes in interest rates, spending patterns, fees,
          or other factors not accounted for in our models.
        </p>

        <p>
          Your financial data is processed using third-party AI services (OpenAI) for
          statement parsing. While we take reasonable measures to protect your information,
          you acknowledge that your financial data will be transmitted to these services for
          processing. We do not store your original statement files — only the extracted
          data is retained in our database.
        </p>

        <p>
          CardPulse is provided &quot;as is&quot; and &quot;as available&quot; without
          warranties of any kind, whether express or implied, including but not limited to
          implied warranties of merchantability, fitness for a particular purpose, and
          non-infringement. In no event shall the developers of CardPulse be liable for
          any indirect, incidental, special, consequential, or punitive damages, or any
          loss of profits or revenue, whether incurred directly or indirectly.
        </p>

        <p>
          By using CardPulse, you agree that you are using the application at your own risk
          and that you are solely responsible for any actions taken based on the information
          provided. You agree not to hold the developers liable for any inaccuracies in
          data parsing, forecasting, or any other functionality of the application.
        </p>

        <p>
          Transaction categorisation is performed automatically using artificial intelligence
          and may not always be accurate. You should review and correct categories as needed.
          Category corrections you make are stored to improve future categorisation accuracy
          for your account only.
        </p>

        <p className="pt-2 text-gray-400">
          &copy; {new Date().getFullYear()} CardPulse. All rights reserved.
          <br />
          This application is for personal use only.
        </p>
      </div>

      <div className="h-24" />
    </div>
  )
}
