import { NextRequest, NextResponse } from "next/server";
import { resolveDbUser, errorResponse } from "@/src/utils/api-helpers";
import { processBlog } from "@/src/services/summarisation";
import { generateAudio } from "@/src/services/audio";
import { getSummary, markProcessing } from "@/src/models/summarisation";
import { logger } from "@/src/utils/logger";

/**
 * POST /api/blogs/:id/process
 * Trigger summarisation pipeline for a blog (fire-and-forget).
 * Returns immediately with status: "processing".
 * Client should poll GET /api/blogs/:id/summary for completion.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const user = await resolveDbUser();
  if (!user) return errorResponse("Unauthorized", 401);

  const { id: blogId } = await params;
  const force = req.nextUrl.searchParams.get("force") === "true";

  try {
    const existing = await getSummary(blogId);

    // Block if already processing and not forced
    if (existing?.status === "processing" && !force) {
      return errorResponse("Blog is already being processed", 409);
    }

    // Mark as processing immediately so client can start polling
    await markProcessing(blogId);

    // Fire-and-forget — client polls GET /api/blogs/:id/summary
    void (async () => {
      try {
        const row = await processBlog(blogId, force);
        if (row.learningShort && !row.audioUrl) {
          void generateAudio(row.learningShort, blogId);
        }
        logger.info({ userId: user.id, blogId, status: row.status }, "Blog processed");
      } catch (err) {
        logger.error({ err, userId: user.id, blogId }, "Blog processing error");
      }
    })();

    return NextResponse.json({ blogId, status: "processing" });
  } catch (err) {
    logger.error({ err, userId: user.id, blogId }, "Failed to start processing");
    return errorResponse("Failed to start processing", 500);
  }
}
