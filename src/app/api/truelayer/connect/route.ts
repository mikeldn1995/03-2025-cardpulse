import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { buildAuthUrl } from "@/lib/truelayer"

// GET: Redirect user to TrueLayer bank auth
export async function GET() {
  const result = await getSession()
  if (!result) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // State param encodes the user ID so we can link on callback
  const state = Buffer.from(JSON.stringify({ userId: result.user.id })).toString("base64url")
  const url = buildAuthUrl(state)

  return NextResponse.redirect(url)
}
