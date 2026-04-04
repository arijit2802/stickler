import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resolveDbUser, errorResponse } from "@/src/utils/api-helpers";
import { getPendingSuggestions } from "@/src/models/discovery";
import { confirmAndSchedule, tomorrow } from "@/src/services/calendar";
import { processBlog } from "@/src/services/summarisation";
import { logger } from "@/src/utils/logger";

const ConfirmBody = z.object({
  suggestionIds: z.array(z.string().uuid()).min(1).max(10),
  scheduledDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD")
    .optional(),
});

/**
 * POST /api/discovery/confirm
 * Confirm selected suggestions and add their blogs to the reading calendar.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const user = await resolveDbUser();
  if (!user) return errorResponse("Unauthorized", 401);

  const body: unknown = await req.json().catch(() => null);
  const parsed = ConfirmBody.safeParse(body);
  if (!parsed.success) {
    return errorResponse(parsed.error.errors[0]?.message ?? "Invalid request", 400);
  }

  const { suggestionIds, scheduledDate = tomorrow() } = parsed.data;

  try {
    // Resolve blog IDs from suggestion IDs (validate ownership)
    const pending = await getPendingSuggestions(user.id);
    const validSuggestions = pending.filter((s) => suggestionIds.includes(s.id));

    if (validSuggestions.length === 0) {
      return errorResponse("No valid pending suggestions found", 400);
    }

    const blogIds = validSuggestions.map((s) => s.blogId);
    const validIds = validSuggestions.map((s) => s.id);

    await confirmAndSchedule(user.id, validIds, blogIds, scheduledDate);

    // Kick off summarisation for each confirmed blog (fire-and-forget; non-blocking)
    for (const blogId of blogIds) {
      processBlog(blogId).catch((err) =>
        logger.warn({ err, blogId }, "Background summarisation failed")
      );
    }

    logger.info({ userId: user.id, count: validIds.length, scheduledDate }, "Suggestions confirmed");
    return NextResponse.json({ confirmed: validIds.length, scheduledDate });
  } catch (err) {
    logger.error({ err, userId: user.id }, "Failed to confirm suggestions");
    return errorResponse("Failed to confirm suggestions", 500);
  }
}
