import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resolveDbUser, errorResponse } from "@/src/utils/api-helpers";
import { getWeek, markStatus } from "@/src/services/calendar";
import { logger } from "@/src/utils/logger";

const MarkStatusBody = z.object({
  entryId: z.string().uuid(),
  status: z.enum(["read", "skipped"]),
});

/**
 * GET /api/calendar?weekOf=YYYY-MM-DD
 * Fetch the user's reading calendar for a week (defaults to current week).
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const user = await resolveDbUser();
  if (!user) return errorResponse("Unauthorized", 401);

  const weekOf = req.nextUrl.searchParams.get("weekOf") ?? undefined;

  // Validate date format if provided
  if (weekOf && !/^\d{4}-\d{2}-\d{2}$/.test(weekOf)) {
    return errorResponse("weekOf must be YYYY-MM-DD", 400);
  }

  try {
    const result = await getWeek(user.id, weekOf);
    logger.info({ userId: user.id, weekOf: result.weekOf, count: result.entries.length }, "Calendar fetched");
    return NextResponse.json(result);
  } catch (err) {
    logger.error({ err, userId: user.id }, "Failed to fetch calendar");
    return errorResponse("Failed to fetch calendar", 500);
  }
}

/**
 * PATCH /api/calendar
 * Mark a calendar entry as read or skipped.
 */
export async function PATCH(req: NextRequest): Promise<NextResponse> {
  const user = await resolveDbUser();
  if (!user) return errorResponse("Unauthorized", 401);

  const body: unknown = await req.json().catch(() => null);
  const parsed = MarkStatusBody.safeParse(body);
  if (!parsed.success) {
    return errorResponse(parsed.error.errors[0]?.message ?? "Invalid request", 400);
  }

  try {
    await markStatus(parsed.data.entryId, parsed.data.status);
    logger.info({ userId: user.id, ...parsed.data }, "Calendar entry marked");
    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error({ err, userId: user.id }, "Failed to update calendar entry");
    return errorResponse("Failed to update entry", 500);
  }
}
