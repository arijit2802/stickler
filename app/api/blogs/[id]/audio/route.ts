import { NextRequest, NextResponse } from "next/server";
import { resolveDbUser, errorResponse } from "@/src/utils/api-helpers";
import { getAudioUrl, generateAudio } from "@/src/services/audio";
import { getSummary } from "@/src/models/summarisation";
import { logger } from "@/src/utils/logger";

/**
 * GET /api/blogs/:id/audio
 * Returns audioUrl, audioStatus, and the podcast script for a blog.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const user = await resolveDbUser();
  if (!user) return errorResponse("Unauthorized", 401);

  const { id: blogId } = await params;

  try {
    const result = await getAudioUrl(blogId);
    logger.info({ blogId, audioStatus: result.audioStatus }, "Audio fetched");
    return NextResponse.json(result);
  } catch (err) {
    logger.error({ err, blogId }, "Failed to fetch audio");
    return errorResponse("Failed to fetch audio", 500);
  }
}

/**
 * POST /api/blogs/:id/audio/generate
 * Trigger (or retry) audio generation for a blog's podcast script.
 * Returns 409 if already generating, 400 if no script exists yet.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const user = await resolveDbUser();
  if (!user) return errorResponse("Unauthorized", 401);

  const { id: blogId } = await params;

  try {
    const summary = await getSummary(blogId);

    if (!summary) return errorResponse("Blog not processed yet", 400);
    if (summary.audioStatus === "generating") {
      return NextResponse.json({ message: "Audio generation already in progress" }, { status: 409 });
    }
    if (!summary.learningShort) return errorResponse("No podcast script available", 400);

    // Fire-and-forget — client polls GET to check status
    void generateAudio(summary.learningShort, blogId);

    logger.info({ blogId }, "Audio generation triggered");
    return NextResponse.json({ message: "Audio generation started", audioStatus: "generating" });
  } catch (err) {
    logger.error({ err, blogId }, "Failed to trigger audio generation");
    return errorResponse("Failed to trigger audio generation", 500);
  }
}
