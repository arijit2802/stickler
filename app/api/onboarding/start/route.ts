import { NextResponse } from "next/server";
import { resolveDbUser, errorResponse } from "@/src/utils/api-helpers";
import { startSession } from "@/src/services/onboarding-agent";
import { logger } from "@/src/utils/logger";

/** POST /api/onboarding/start — begin or resume an onboarding session */
export async function POST(): Promise<NextResponse> {
  const user = await resolveDbUser();
  if (!user) return errorResponse("Unauthorised", 401);

  try {
    const result = await startSession(user.id);
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    logger.error({ err, userId: user.id }, "Failed to start onboarding session");
    return errorResponse("Failed to start session. Please try again.", 500);
  }
}
