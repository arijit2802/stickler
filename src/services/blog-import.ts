import { tavily } from "@tavily/core";
import { logger } from "@/src/utils/logger";
import { upsertBlog, addToCalendar, isInCalendar, updateBlogRawContent } from "@/src/models/discovery";
import { processBlog } from "@/src/services/summarisation";
import type { BlogMeta } from "@/src/types/blog-import";

// ─── URL Validation ───────────────────────────────────────────────────────────

const BROWSER_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

/**
 * Perform a HEAD request to check if a URL is reachable.
 * Falls back to GET with Range: bytes=0-0 when HEAD returns 403/405
 * (common on Medium, Substack, and other sites that block HEAD).
 */
export async function validateUrl(
  url: string
): Promise<{ reachable: boolean; statusCode?: number; finalUrl: string }> {
  const headers = { "User-Agent": BROWSER_UA };

  // ── HEAD attempt ──────────────────────────────────────────────────────────
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(url, { method: "HEAD", redirect: "follow", signal: controller.signal, headers });
    clearTimeout(timeout);

    // Sites like Medium return 403 on HEAD but serve the page fine via GET
    if (res.status !== 403 && res.status !== 405) {
      return { reachable: res.status < 400, statusCode: res.status, finalUrl: res.url || url };
    }
    logger.info({ url, status: res.status }, "HEAD blocked — retrying with GET range request");
  } catch (err) {
    const isAbort = err instanceof Error && err.name === "AbortError";
    if (isAbort) {
      logger.warn({ url }, "HEAD request timed out");
      return { reachable: false, finalUrl: url };
    }
    logger.warn({ url, err: String(err) }, "HEAD request failed — retrying with GET");
  }

  // ── GET fallback (range request — minimal data transfer) ──────────────────
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: { ...headers, Range: "bytes=0-1023" },
    });
    clearTimeout(timeout);
    // 206 Partial Content or 200 both mean the page exists
    return {
      reachable: res.status < 400 || res.status === 206,
      statusCode: res.status,
      finalUrl: res.url || url,
    };
  } catch (err) {
    const isAbort = err instanceof Error && err.name === "AbortError";
    logger.warn({ url, err: String(err) }, isAbort ? "GET fallback timed out" : "GET fallback failed");
    return { reachable: false, finalUrl: url };
  }
}

// ─── Metadata Enrichment ──────────────────────────────────────────────────────

/**
 * Attempt to extract blog metadata via Tavily.
 * Falls back to hostname/path-derived values if extraction fails.
 */
export async function enrichBlogMeta(url: string): Promise<BlogMeta> {
  const hostname = new URL(url).hostname.replace(/^www\./, "");
  const pathTitle = new URL(url).pathname
    .split("/")
    .filter(Boolean)
    .pop()
    ?.replace(/-/g, " ") ?? "";

  const fallback: BlogMeta = {
    url,
    title: pathTitle || hostname,
    source: hostname,
    author: null,
    estimatedReadMin: null,
  };

  if (!process.env.TAVILY_API_KEY) return fallback;

  try {
    const client = tavily({ apiKey: process.env.TAVILY_API_KEY });
    const result = await client.extract([url]);
    const extracted = result.results?.[0];
    if (!extracted) return fallback;

    const wordCount = (extracted.rawContent ?? "").split(/\s+/).length;
    const estimatedReadMin = Math.max(1, Math.round(wordCount / 200));

    return {
      url,
      title: extracted.title ?? fallback.title,
      source: hostname,
      author: null, // Tavily extract doesn't return author
      estimatedReadMin,
    };
  } catch (err) {
    logger.warn({ url, err: String(err) }, "Tavily enrichment failed — using fallback metadata");
    return fallback;
  }
}

// ─── Import Orchestration ─────────────────────────────────────────────────────

/**
 * Import a blog URL into the user's reading calendar.
 * Upserts the blog row, checks for duplicates, inserts calendar entry,
 * and fires processBlog() as a background task.
 */
export async function importBlog(
  userId: string,
  url: string,
  title: string,
  source: string,
  scheduledDate: string
): Promise<{ blogId: string; entryId: string; scheduledDate: string }> {
  // Upsert the blog row
  const blog = await upsertBlog({ url, title, source });

  // Check for duplicate in calendar
  const alreadyInCalendar = await isInCalendar(userId, blog.id);
  if (alreadyInCalendar) {
    throw new Error("DUPLICATE");
  }

  // Add to reading calendar
  const [entry] = await addToCalendar([{ userId, blogId: blog.id, scheduledDate }]);

  logger.info({ userId, blogId: blog.id, scheduledDate }, "Blog manually imported to calendar");

  // Pre-fetch and store rawContent so processBlog has a fallback if Tavily rate-limits
  if (process.env.TAVILY_API_KEY && !blog.rawContent) {
    try {
      const client = tavily({ apiKey: process.env.TAVILY_API_KEY });
      const result = await client.extract([url]);
      const rawContent = result.results?.[0]?.rawContent ?? null;
      if (rawContent && rawContent.trim().length > 100) {
        await updateBlogRawContent(blog.id, rawContent);
        logger.info({ blogId: blog.id }, "rawContent pre-stored for summarisation fallback");
      }
    } catch (err) {
      logger.warn({ err, blogId: blog.id }, "rawContent pre-fetch failed — processBlog will retry via Tavily");
    }
  }

  // Fire-and-forget summarisation
  void processBlog(blog.id).catch((err: unknown) => {
    logger.warn({ err, blogId: blog.id }, "Background processBlog failed after manual import");
  });

  return { blogId: blog.id, entryId: entry.id, scheduledDate: entry.scheduledDate };
}
