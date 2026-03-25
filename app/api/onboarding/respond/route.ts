import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resolveDbUser, errorResponse, sanitise } from "@/src/utils/api-helpers";
import { processResponse } from "@/src/services/onboarding-agent";
import { getSession } from "@/src/models/onboarding";
import { logger } from "@/src/utils/logger";

const RespondSchema = z.object({
  sessionId: z.string().uuid("Invalid session ID"),
  message: z
    .string()
    .min(1, "Message cannot be empty")
    .max(2000, "Message too long"),
});

/** POST /api/onboarding/respond — submit one user turn, receive Claude's next question */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const user = await resolveDbUser();
  if (!user) return errorResponse("Unauthorised", 401);

  const body: unknown = await req.json();
  const parsed = RespondSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(parsed.error.issues[0]?.message ?? "Invalid input", 400);
  }

  const { sessionId, message } = parsed.data;

  // Verify session belongs to this user
  const session = await getSession(sessionId);
  if (!session) return errorResponse("Session not found", 404);
  if (session.userId !== user.id) return errorResponse("Forbidden", 403);
  if (session.isComplete) return errorResponse("Session already complete", 409);

  try {
    const result = await processResponse(sessionId, sanitise(message));
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    logger.error({ err, sessionId }, "Failed to process onboarding response");
    return errorResponse(
      "Something went wrong. Please try again or use the manual form.",
      500
    );
  }
}
