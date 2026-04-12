import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resolveDbUser, errorResponse } from "@/src/utils/api-helpers";
import { validateUrl, enrichBlogMeta } from "@/src/services/blog-import";
import { getBlogByUrl, isInCalendar } from "@/src/models/discovery";
import { logger } from "@/src/utils/logger";
import type { ValidateUrlResponse } from "@/src/types/blog-import";

const bodySchema = z.object({
  url: z.string().url(),
});

/**
 * POST /api/blogs/import/validate
 * Validates a URL is reachable and returns extracted metadata.
 * Returns { valid: false, reason } for 404/unreachable URLs.
 * Returns { valid: true, duplicate: true } if already in user's calendar.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const user = await resolveDbUser();
  if (!user) return errorResponse("Unauthorized", 401);

  const body: unknown = await req.json();
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return errorResponse("Invalid URL", 400);

  const { url } = parsed.data;

  // Basic scheme check
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    return NextResponse.json<ValidateUrlResponse>({
      valid: false,
      reason: "URL must start with http:// or https://",
    });
  }

  try {
    const { reachable, statusCode, finalUrl } = await validateUrl(url);

    if (!reachable) {
      const reason =
        statusCode === 404
          ? "This page doesn't exist (404). Please check the URL."
          : statusCode && statusCode >= 400 && statusCode < 500
          ? `This page returned an error (${statusCode}). Please check the URL.`
          : "Couldn't reach this page. The site may be down — try again later.";

      logger.info({ url, statusCode }, "URL validation failed");
      return NextResponse.json<ValidateUrlResponse>({ valid: false, reason });
    }

    // Check for duplicate in user's calendar
    const existingBlog = await getBlogByUrl(finalUrl);
    if (existingBlog) {
      const duplicate = await isInCalendar(user.id, existingBlog.id);
      if (duplicate) {
        const meta = await enrichBlogMeta(finalUrl);
        return NextResponse.json<ValidateUrlResponse>({ valid: true, duplicate: true, meta });
      }
    }

    // Enrich metadata via Tavily
    const meta = await enrichBlogMeta(finalUrl);
    logger.info({ url: finalUrl }, "URL validated and enriched");
    return NextResponse.json<ValidateUrlResponse>({ valid: true, meta });
  } catch (err) {
    logger.error({ err, url }, "URL validation error");
    return errorResponse("Validation failed", 500);
  }
}
