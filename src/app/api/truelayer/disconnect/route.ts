import { NextResponse } from "next/server"
import { db } from "@/db"
import { truelayerConnections } from "@/db/schema"
import { eq } from "drizzle-orm"
import { getSession } from "@/lib/auth"

// POST: Remove TrueLayer connection
export async function POST() {
  const result = await getSession()
  if (!result) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  await db.delete(truelayerConnections).where(eq(truelayerConnections.userId, result.user.id))

  return NextResponse.json({ ok: true })
}
