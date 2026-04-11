import { NextResponse } from "next/server";
import { resolveDbUser, errorResponse } from "@/src/utils/api-helpers";
import { runDiscovery } from "@/src/services/blog-discovery";
import { logger } from "@/src/utils/logger";

/**
 * POST /api/discovery/run
 * Trigger the agentic blog discovery pipeline for the authenticated user.
 * Returns 3 pending suggestions for user confirmation.
 */
export async function POST(): Promise<NextResponse> {
  const user = await resolveDbUser();
  if (!user) return errorResponse("Unauthorized", 401);

  try {
    const suggestions = await runDiscovery(user.id);
    logger.info({ userId: user.id, count: suggestions.length }, "Discovery run complete");
    return NextResponse.json({ suggestions });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Discovery failed";
    logger.error({ err, userId: user.id }, "Discovery run error");

    if (message.includes("complete onboarding first")) {
      return errorResponse("Complete onboarding before running discovery", 400);
    }
    if (message.includes("TAVILY_API_KEY")) {
      return errorResponse("Search service is not configured", 503);
    }
    return errorResponse("Blog discovery failed. Please try again.", 500);
  }
}
