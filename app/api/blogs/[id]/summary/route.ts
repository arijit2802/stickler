import { NextRequest, NextResponse } from "next/server";
import { resolveDbUser, errorResponse } from "@/src/utils/api-helpers";
import { getBlogSummary } from "@/src/services/summarisation";
import { logger } from "@/src/utils/logger";
import type { GetSummaryResponse } from "@/src/types/summarisation";

/**
 * GET /api/blogs/:id/summary
 * Returns summary, keywords, and learning short for a blog.
 * Returns status: "none" if the blog has not been processed yet.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const user = await resolveDbUser();
  if (!user) return errorResponse("Unauthorized", 401);

  const { id: blogId } = await params;

  try {
    const summary = await getBlogSummary(blogId);

    const response: GetSummaryResponse = summary
      ? {
          blogId,
          status: (summary.status ?? "none") as GetSummaryResponse["status"],
          summaryBullets: (summary.summaryBullets as string[]) ?? [],
          keywords: (summary.keywords as { term: string; definition: string }[]) ?? [],
          learningShort: summary.learningShort,
          audioUrl: summary.audioUrl,
          audioStatus: (summary.audioStatus ?? "none") as GetSummaryResponse["audioStatus"],
          interviewAudioUrl: summary.interviewAudioUrl,
          interviewAudioStatus: (summary.interviewAudioStatus ?? "none") as GetSummaryResponse["interviewAudioStatus"],
          interviewScript: summary.interviewScript,
          processedAt: summary.processedAt?.toISOString() ?? null,
        }
      : {
          blogId,
          status: "none",
          summaryBullets: [],
          keywords: [],
          learningShort: null,
          audioUrl: null,
          audioStatus: "none",
          interviewAudioUrl: null,
          interviewAudioStatus: "none",
          interviewScript: null,
          processedAt: null,
        };

    logger.info({ blogId, status: response.status }, "Summary fetched");
    return NextResponse.json(response);
  } catch (err) {
    logger.error({ err, blogId }, "Failed to fetch summary");
    return errorResponse("Failed to fetch summary", 500);
  }
}
