import { NextResponse } from "next/server"
import { db } from "@/db"
import { otpCodes, users, sessions } from "@/db/schema"
import { eq, and, gt, desc } from "drizzle-orm"
import { generateToken } from "@/lib/auth"
import { cookies } from "next/headers"

export async function POST(req: Request) {
  const { email, code } = await req.json()
  if (!email || !code) return NextResponse.json({ error: "Email and code required" }, { status: 400 })

  const normalizedEmail = email.toLowerCase().trim()

  // Find valid OTP
  const otpResult = await db
    .select()
    .from(otpCodes)
    .where(
      and(
        eq(otpCodes.email, normalizedEmail),
        eq(otpCodes.code, code),
        eq(otpCodes.used, false),
        gt(otpCodes.expiresAt, new Date())
      )
    )
    .orderBy(desc(otpCodes.createdAt))
    .limit(1)

  if (otpResult.length === 0) {
    return NextResponse.json({ error: "Invalid or expired code" }, { status: 401 })
  }

  // Mark OTP as used
  await db.update(otpCodes).set({ used: true }).where(eq(otpCodes.id, otpResult[0].id))

  // Get user
  const userResult = await db.select().from(users).where(eq(users.email, normalizedEmail)).limit(1)
  if (userResult.length === 0) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }

  const user = userResult[0]

  // Create session (30 days)
  const token = generateToken()
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  await db.insert(sessions).values({ userId: user.id, token, expiresAt })

  // Set cookie
  const cookieStore = await cookies()
  cookieStore.set("session_token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: expiresAt,
    path: "/",
  })

  return NextResponse.json({
    ok: true,
    user: { id: user.id, email: user.email, name: user.name },
  })
}
