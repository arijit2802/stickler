import { NextRequest, NextResponse } from "next/server";
import { resolveDbUser, errorResponse } from "@/src/utils/api-helpers";
import { generateInterviewAudio, getInterview } from "@/src/services/interview";
import { getInterviewStatus } from "@/src/models/summarisation";
import { logger } from "@/src/utils/logger";
import type { GetInterviewResponse } from "@/src/types/summarisation";

/**
 * GET /api/blogs/:id/interview
 * Returns the interview audio URL, status, and script.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  const user = await resolveDbUser();
  if (!user) return errorResponse("Unauthorized", 401);

  const blogId = params.id;

  try {
    const data = await getInterview(blogId);
    const response: GetInterviewResponse = {
      interviewAudioUrl: data.interviewAudioUrl,
      interviewAudioStatus: data.interviewAudioStatus as GetInterviewResponse["interviewAudioStatus"],
      interviewScript: data.interviewScript,
    };
    return NextResponse.json(response);
  } catch (err) {
    logger.error({ err, blogId }, "Failed to fetch interview status");
    return errorResponse("Failed to fetch interview status", 500);
  }
}

/**
 * POST /api/blogs/:id/interview
 * Triggers two-voice interview audio generation (fire-and-forget).
 * Returns 409 if already generating.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  const user = await resolveDbUser();
  if (!user) return errorResponse("Unauthorized", 401);

  const blogId = params.id;

  try {
    const existing = await getInterviewStatus(blogId);
    if (existing?.interviewAudioStatus === "generating") {
      return NextResponse.json({ message: "Interview generation already in progress" }, { status: 409 });
    }

    // Fire-and-forget — client polls GET to check status
    void generateInterviewAudio(blogId).catch((err: unknown) => {
      logger.warn({ err, blogId }, "Background interview generation failed");
    });

    logger.info({ blogId, userId: user.id }, "Interview audio generation triggered");
    return NextResponse.json({ message: "Interview generation started", interviewAudioStatus: "generating" });
  } catch (err) {
    logger.error({ err, blogId }, "Failed to start interview generation");
    return errorResponse("Failed to start interview generation", 500);
  }
}
