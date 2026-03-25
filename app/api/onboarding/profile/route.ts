import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resolveDbUser, errorResponse } from "@/src/utils/api-helpers";
import { getProfile, updateProfile } from "@/src/models/onboarding";
import { logger } from "@/src/utils/logger";

const UpdateProfileSchema = z.object({
  role: z.string().min(1).optional(),
  interests: z
    .array(
      z.object({
        topic: z.string().min(1),
        depth: z.string().min(1),
        keywords: z.array(z.string()),
      })
    )
    .optional(),
  aspirations: z
    .array(z.object({ goal: z.string().min(1), priority: z.number().int().min(1) }))
    .optional(),
  knowledgeLevel: z
    .array(
      z.object({
        topic: z.string().min(1),
        level: z.enum(["beginner", "intermediate", "advanced"]),
      })
    )
    .optional(),
  motivation: z.string().min(1).optional(),
});

/** GET /api/onboarding/profile — fetch the current user's learning profile */
export async function GET(): Promise<NextResponse> {
  const user = await resolveDbUser();
  if (!user) return errorResponse("Unauthorised", 401);

  const profile = await getProfile(user.id);
  if (!profile) return errorResponse("Profile not found", 404);

  return NextResponse.json(profile, { status: 200 });
}

/** PATCH /api/onboarding/profile — update specific fields without re-interview */
export async function PATCH(req: NextRequest): Promise<NextResponse> {
  const user = await resolveDbUser();
  if (!user) return errorResponse("Unauthorised", 401);

  const body: unknown = await req.json();
  const parsed = UpdateProfileSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(parsed.error.issues[0]?.message ?? "Invalid input", 400);
  }

  try {
    const updated = await updateProfile(user.id, parsed.data);
    if (!updated) return errorResponse("Profile not found", 404);
    return NextResponse.json(updated, { status: 200 });
  } catch (err) {
    logger.error({ err, userId: user.id }, "Failed to update profile");
    return errorResponse("Failed to update profile", 500);
  }
}
