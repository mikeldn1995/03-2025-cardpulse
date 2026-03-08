import { NextResponse } from "next/server"
import { db } from "@/db"
import { truelayerConnections } from "@/db/schema"
import { eq } from "drizzle-orm"
import { getSession } from "@/lib/auth"

// GET: Check if user has an active TrueLayer connection
export async function GET() {
  const result = await getSession()
  if (!result) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const connections = await db.select().from(truelayerConnections).where(eq(truelayerConnections.userId, result.user.id))

  return NextResponse.json({
    connected: connections.length > 0,
    connectedAt: connections[0]?.connectedAt || null,
  })
}
