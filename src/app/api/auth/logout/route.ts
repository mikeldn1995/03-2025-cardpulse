import { NextResponse } from "next/server"
import { db } from "@/db"
import { sessions } from "@/db/schema"
import { eq } from "drizzle-orm"
import { cookies } from "next/headers"

export async function POST() {
  const cookieStore = await cookies()
  const token = cookieStore.get("session_token")?.value
  if (token) {
    await db.delete(sessions).where(eq(sessions.token, token))
    cookieStore.delete("session_token")
  }
  return NextResponse.json({ ok: true })
}
