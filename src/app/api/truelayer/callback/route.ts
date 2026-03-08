import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { truelayerConnections } from "@/db/schema"
import { eq } from "drizzle-orm"
import { exchangeCode } from "@/lib/truelayer"

// GET: TrueLayer redirects here after user authorizes
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get("code")
  const state = searchParams.get("state")
  const error = searchParams.get("error")

  if (error || !code || !state) {
    const errorDesc = searchParams.get("error_description") || "Authorization failed"
    return NextResponse.redirect(new URL(`/settings?tl_error=${encodeURIComponent(errorDesc)}`, req.url))
  }

  let userId: number
  try {
    const decoded = JSON.parse(Buffer.from(state, "base64url").toString())
    userId = decoded.userId
  } catch {
    return NextResponse.redirect(new URL("/settings?tl_error=Invalid+state", req.url))
  }

  try {
    const tokens = await exchangeCode(code)

    // Remove old connection for this user (one connection at a time)
    await db.delete(truelayerConnections).where(eq(truelayerConnections.userId, userId))

    // Store new connection
    await db.insert(truelayerConnections).values({
      userId,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
    })

    return NextResponse.redirect(new URL("/settings?tl_connected=1", req.url))
  } catch (err: any) {
    console.error("TrueLayer callback error:", err)
    return NextResponse.redirect(new URL(`/settings?tl_error=${encodeURIComponent(err.message)}`, req.url))
  }
}
