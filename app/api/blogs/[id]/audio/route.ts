import { NextRequest, NextResponse } from "next/server";
import { resolveDbUser, errorResponse } from "@/src/utils/api-helpers";
import { getAudioUrl } from "@/src/services/audio";
import { logger } from "@/src/utils/logger";

/**
 * GET /api/blogs/:id/audio
 * Returns the audio URL for a blog's learning short.
 * Falls back to the script text if no audio file is available.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  const user = await resolveDbUser();
  if (!user) return errorResponse("Unauthorized", 401);

  const blogId = params.id;

  try {
    const { audioUrl, script } = await getAudioUrl(blogId);
    logger.info({ blogId, hasAudio: !!audioUrl }, "Audio fetched");
    return NextResponse.json({ audioUrl, script });
  } catch (err) {
    logger.error({ err, blogId }, "Failed to fetch audio");
    return errorResponse("Failed to fetch audio", 500);
  }
}
