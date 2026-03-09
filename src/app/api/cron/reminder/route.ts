import { NextRequest } from "next/server"
import { db } from "@/db"
import { users, accounts } from "@/db/schema"
import { eq } from "drizzle-orm"
import { Resend } from "resend"
import { reminderEmailHtml } from "@/lib/reminder-email"

const resend = new Resend(process.env.RESEND_API_KEY)
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://cardpulse.app"

export async function GET(req: NextRequest) {
  // Verify Vercel Cron secret
  if (req.headers.get("Authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 })
  }

  try {
    const allUsers = await db.select().from(users)
    let sent = 0

    for (const user of allUsers) {
      const userAccounts = await db
        .select()
        .from(accounts)
        .where(eq(accounts.userId, user.id))

      const now = new Date()
      const staleAccounts: { institution: string; accountName: string; lastUpdate: string }[] = []

      for (const account of userAccounts) {
        const lastDate = account.lastStatementDate
          ? new Date(account.lastStatementDate)
          : null

        // Account is stale if no statement date, or last statement > 30 days ago,
        // or the statement day is approaching (within 3 days)
        let isStale = false
        let lastUpdateLabel = "Never updated"

        if (!lastDate) {
          isStale = true
        } else {
          const daysSince = Math.floor(
            (now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24),
          )

          if (daysSince > 30) {
            isStale = true
            lastUpdateLabel = `${daysSince} days ago`
          } else if (account.statementDay) {
            // Check if statement day is approaching (within 3 days)
            const currentDay = now.getDate()
            const diff = account.statementDay - currentDay
            if (diff >= 0 && diff <= 3) {
              isStale = true
              lastUpdateLabel = `${daysSince} days ago (statement day approaching)`
            }
          }

          if (!isStale) continue
          if (lastUpdateLabel === "Never updated") {
            lastUpdateLabel = `${Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24))} days ago`
          }
        }

        if (isStale) {
          staleAccounts.push({
            institution: account.institution,
            accountName: account.accountName,
            lastUpdate: lastUpdateLabel,
          })
        }
      }

      if (staleAccounts.length > 0 && user.email) {
        await resend.emails.send({
          from: "CardPulse <notifications@cardpulse.app>",
          to: user.email,
          subject: `${staleAccounts.length} account${staleAccounts.length === 1 ? "" : "s"} need${staleAccounts.length === 1 ? "s" : ""} updating`,
          html: reminderEmailHtml(user.name || "there", staleAccounts, APP_URL),
        })
        sent++
      }
    }

    return Response.json({ success: true, emailsSent: sent })
  } catch (error) {
    console.error("Reminder cron failed:", error)
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
}
