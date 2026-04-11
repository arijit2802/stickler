import { NextRequest, NextResponse } from "next/server";
import { resolveDbUser, errorResponse } from "@/src/utils/api-helpers";
import { processBlog } from "@/src/services/summarisation";
import { generateAudio } from "@/src/services/audio";
import { getSummary } from "@/src/models/summarisation";
import { logger } from "@/src/utils/logger";

/**
 * POST /api/blogs/:id/process
 * Trigger summarisation pipeline for a blog.
 * Runs: content fetch → summary → keywords → learning short → optional audio.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  const user = await resolveDbUser();
  if (!user) return errorResponse("Unauthorized", 401);

  const blogId = params.id;
  const force = req.nextUrl.searchParams.get("force") === "true";

  try {
    const row = await processBlog(blogId, force);

    // Fire-and-forget audio generation — client polls GET /api/blogs/:id/audio for status
    if (row.learningShort && !row.audioUrl) {
      void generateAudio(row.learningShort, blogId);
    }

    logger.info({ userId: user.id, blogId, status: row.status }, "Blog processed");
    return NextResponse.json({ blogId, status: row.status });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Processing failed";
    logger.error({ err, userId: user.id, blogId }, "Blog processing error");

    if (message.includes("already being processed")) {
      return errorResponse("Blog is already being processed", 409);
    }
    if (message.includes("content could not be fetched") || message.includes("not found")) {
      // Fetch final status from DB (was marked unprocessable)
      const summary = await getSummary(blogId);
      return NextResponse.json(
        { blogId, status: summary?.status ?? "unprocessable" },
        { status: 200 }
      );
    }
    return errorResponse("Blog processing failed. Please try again.", 500);
  }
}
