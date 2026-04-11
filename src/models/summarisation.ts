import { eq } from "drizzle-orm";
import { db } from "@/db";
import { blogSummaries, blogs } from "@/db/schema";
import type { BlogSummary, NewBlogSummary } from "@/db/schema";

/**
 * Get the summary record for a blog, or null if not yet processed.
 */
export async function getSummary(blogId: string): Promise<BlogSummary | null> {
  const [row] = await db
    .select()
    .from(blogSummaries)
    .where(eq(blogSummaries.blogId, blogId))
    .limit(1);
  return row ?? null;
}

/**
 * Upsert a summary record. Creates on first process, updates on retry.
 */
export async function upsertSummary(data: NewBlogSummary): Promise<BlogSummary> {
  const [row] = await db
    .insert(blogSummaries)
    .values(data)
    .onConflictDoUpdate({
      target: blogSummaries.blogId,
      set: {
        summaryBullets: data.summaryBullets,
        keywords: data.keywords,
        learningShort: data.learningShort,
        audioUrl: data.audioUrl,
        status: data.status,
        processedAt: data.processedAt,
      },
    })
    .returning();
  return row;
}

/**
 * Mark a blog summary as processing (prevents duplicate concurrent runs).
 */
export async function markProcessing(blogId: string): Promise<void> {
  await db
    .insert(blogSummaries)
    .values({ blogId, status: "processing" })
    .onConflictDoUpdate({
      target: blogSummaries.blogId,
      set: { status: "processing" },
    });
}

/**
 * Mark a blog as unprocessable (e.g. content could not be scraped).
 */
export async function markUnprocessable(blogId: string): Promise<void> {
  await db
    .insert(blogSummaries)
    .values({ blogId, status: "unprocessable", processedAt: new Date() })
    .onConflictDoUpdate({
      target: blogSummaries.blogId,
      set: { status: "unprocessable", processedAt: new Date() },
    });
}

/**
 * Get raw content for a blog from the blogs table.
 */
export async function getBlogContent(
  blogId: string
): Promise<{ url: string; title: string; rawContent: string | null } | null> {
  const [row] = await db
    .select({ url: blogs.url, title: blogs.title, rawContent: blogs.rawContent })
    .from(blogs)
    .where(eq(blogs.id, blogId))
    .limit(1);
  return row ?? null;
}

/**
 * Save the audio URL back to an existing summary row.
 */
export async function saveAudioUrl(blogId: string, audioUrl: string): Promise<void> {
  await db
    .update(blogSummaries)
    .set({ audioUrl })
    .where(eq(blogSummaries.blogId, blogId));
}
