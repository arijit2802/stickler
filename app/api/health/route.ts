import { NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { logger } from "@/src/utils/logger";

/**
 * GET /api/health
 * Liveness + readiness check.
 * Returns 200 when the server and DB are healthy, 503 otherwise.
 * Safe to expose publicly — returns no sensitive data.
 */
export async function GET(): Promise<NextResponse> {
  try {
    await db.execute(sql`SELECT 1`);
    return NextResponse.json(
      { status: "ok", db: "ok", ts: new Date().toISOString() },
      { status: 200 }
    );
  } catch (err) {
    logger.error({ err }, "Health check: DB unreachable");
    return NextResponse.json(
      { status: "degraded", db: "unreachable" },
      { status: 503 }
    );
  }
}
