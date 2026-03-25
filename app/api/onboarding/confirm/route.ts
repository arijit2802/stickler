import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resolveDbUser, errorResponse } from "@/src/utils/api-helpers";
import { confirmProfile } from "@/src/services/onboarding-agent";
import { getSession } from "@/src/models/onboarding";
import { logger } from "@/src/utils/logger";

const InterestSchema = z.object({
  topic: z.string().min(1),
  depth: z.string().min(1),
  keywords: z.array(z.string()),
});

const AspirationSchema = z.object({
  goal: z.string().min(1),
  priority: z.number().int().min(1).max(10),
});

const KnowledgeLevelSchema = z.object({
  topic: z.string().min(1),
  level: z.enum(["beginner", "intermediate", "advanced"]),
});

const ConfirmSchema = z.object({
  sessionId: z.string().uuid(),
  profileData: z.object({
    role: z.string().min(1, "Role is required"),
    interests: z.array(InterestSchema).min(1, "At least one interest required"),
    aspirations: z.array(AspirationSchema),
    knowledgeLevel: z.array(KnowledgeLevelSchema),
    motivation: z.string().min(1, "Motivation is required"),
  }),
});

/** POST /api/onboarding/confirm — save the confirmed learning profile */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const user = await resolveDbUser();
  if (!user) return errorResponse("Unauthorised", 401);

  const body: unknown = await req.json();
  const parsed = ConfirmSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(parsed.error.issues[0]?.message ?? "Invalid profile data", 400);
  }

  const { sessionId, profileData } = parsed.data;

  // Verify session ownership
  const session = await getSession(sessionId);
  if (!session) return errorResponse("Session not found", 404);
  if (session.userId !== user.id) return errorResponse("Forbidden", 403);

  try {
    await confirmProfile(sessionId, user.id, profileData);
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    logger.error({ err, sessionId }, "Failed to confirm profile");
    return errorResponse("Failed to save profile. Please try again.", 500);
  }
}
