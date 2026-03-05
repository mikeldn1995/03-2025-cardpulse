import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"

export async function GET() {
  const result = await getSession()
  if (!result) {
    return NextResponse.json({ user: null })
  }
  return NextResponse.json({
    user: { id: result.user.id, email: result.user.email, name: result.user.name },
  })
}
