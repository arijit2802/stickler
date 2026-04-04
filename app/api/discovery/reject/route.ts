import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resolveDbUser, errorResponse } from "@/src/utils/api-helpers";
import { rejectAndReplace } from "@/src/services/blog-discovery";
import { logger } from "@/src/utils/logger";

const RejectBody = z.object({
  suggestionId: z.string().uuid(),
});

/**
 * POST /api/discovery/reject
 * Reject a single suggestion and attempt to find a replacement.
 * Returns the replacement suggestion or null if none found.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const user = await resolveDbUser();
  if (!user) return errorResponse("Unauthorized", 401);

  const body: unknown = await req.json().catch(() => null);
  const parsed = RejectBody.safeParse(body);
  if (!parsed.success) {
    return errorResponse(parsed.error.errors[0]?.message ?? "Invalid request", 400);
  }

  try {
    const replacement = await rejectAndReplace(user.id, parsed.data.suggestionId);
    logger.info({ userId: user.id, suggestionId: parsed.data.suggestionId }, "Suggestion rejected");
    return NextResponse.json({ replacement });
  } catch (err) {
    logger.error({ err, userId: user.id }, "Failed to reject suggestion");
    return errorResponse("Failed to reject suggestion", 500);
  }
}
