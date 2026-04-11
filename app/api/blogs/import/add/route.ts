import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resolveDbUser, errorResponse } from "@/src/utils/api-helpers";
import { importBlog } from "@/src/services/blog-import";
import { logger } from "@/src/utils/logger";
import type { ImportBlogResponse } from "@/src/types/blog-import";

const bodySchema = z.object({
  url: z.string().url(),
  title: z.string().min(1).max(500),
  source: z.string().min(1).max(100),
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

/**
 * POST /api/blogs/import/add
 * Upserts a blog and adds it to the user's reading calendar.
 * Triggers processBlog() as a background task.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const user = await resolveDbUser();
  if (!user) return errorResponse("Unauthorized", 401);

  const body: unknown = await req.json();
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse("Invalid request: " + parsed.error.issues[0]?.message, 400);
  }

  const { url, title, source, scheduledDate } = parsed.data;

  try {
    const result = await importBlog(user.id, url, title, source, scheduledDate);
    logger.info({ userId: user.id, blogId: result.blogId, scheduledDate }, "Blog import completed");
    return NextResponse.json<ImportBlogResponse>(result, { status: 201 });
  } catch (err) {
    if (err instanceof Error && err.message === "DUPLICATE") {
      return errorResponse("This article is already in your calendar.", 409);
    }
    logger.error({ err, userId: user.id, url }, "Blog import failed");
    return errorResponse("Failed to add article", 500);
  }
}
