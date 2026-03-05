import { NextResponse } from "next/server"
import { db } from "@/db"
import { otpCodes, users } from "@/db/schema"
import { eq } from "drizzle-orm"
import { generateOTP } from "@/lib/auth"
import { Resend } from "resend"
import { otpEmailHtml } from "@/lib/otp-email"

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: Request) {
  const { email } = await req.json()
  if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 })

  const normalizedEmail = email.toLowerCase().trim()

  // Check if user exists, create if not
  const existing = await db.select().from(users).where(eq(users.email, normalizedEmail)).limit(1)
  if (existing.length === 0) {
    await db.insert(users).values({ email: normalizedEmail, name: "" })
  }

  const code = generateOTP()
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes

  await db.insert(otpCodes).values({ email: normalizedEmail, code, expiresAt })

  try {
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL!,
      to: normalizedEmail,
      subject: `${code} is your CardPulse sign-in code`,
      html: otpEmailHtml(code),
    })
  } catch (e) {
    console.error("Failed to send OTP email:", e)
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
