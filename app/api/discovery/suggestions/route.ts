import { NextResponse } from "next/server";
import { resolveDbUser, errorResponse } from "@/src/utils/api-helpers";
import { getCurrentSuggestions } from "@/src/services/blog-discovery";
import { logger } from "@/src/utils/logger";

/**
 * GET /api/discovery/suggestions
 * Return the current pending (non-expired) blog suggestions for the user.
 */
export async function GET(): Promise<NextResponse> {
  const user = await resolveDbUser();
  if (!user) return errorResponse("Unauthorized", 401);

  try {
    const suggestions = await getCurrentSuggestions(user.id);
    logger.info({ userId: user.id, count: suggestions.length }, "Fetched pending suggestions");
    return NextResponse.json({ suggestions });
  } catch (err) {
    logger.error({ err, userId: user.id }, "Failed to fetch suggestions");
    return errorResponse("Failed to fetch suggestions", 500);
  }
}
