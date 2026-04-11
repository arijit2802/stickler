import { eq, and, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  blogs,
  readingCalendar,
  searchQueries,
  discoverySuggestions,
} from "@/db/schema";
import type {
  Blog,
  NewBlog,
  ReadingCalendarEntry,
  NewReadingCalendarEntry,
  DiscoverySuggestion,
} from "@/db/schema";

// ─── Blogs ────────────────────────────────────────────────────────────────────

/**
 * Upsert a blog by URL. Returns the existing or newly created row.
 */
export async function upsertBlog(data: NewBlog): Promise<Blog> {
  const [row] = await db
    .insert(blogs)
    .values(data)
    .onConflictDoUpdate({
      target: blogs.url,
      set: {
        title: data.title,
        summary: data.summary,
        author: data.author,
        estimatedReadMin: data.estimatedReadMin,
      },
    })
    .returning();
  return row;
}

/**
 * Fetch all blog URLs already seen by a user (in calendar or past suggestions).
 */
export async function getSeenUrls(userId: string): Promise<string[]> {
  const rows = await db
    .select({ url: blogs.url })
    .from(readingCalendar)
    .innerJoin(blogs, eq(readingCalendar.blogId, blogs.id))
    .where(eq(readingCalendar.userId, userId));
  return rows.map((r) => r.url);
}

// ─── Search Queries ───────────────────────────────────────────────────────────

/**
 * Persist a search query audit record.
 */
export async function saveSearchQuery(
  userId: string,
  query: string,
  resultUrls: string[]
): Promise<void> {
  await db.insert(searchQueries).values({ userId, query, resultUrls });
}

// ─── Discovery Suggestions ────────────────────────────────────────────────────

/**
 * Save pending discovery suggestions for a user.
 * Expires any existing pending suggestions first.
 */
export async function saveSuggestions(
  userId: string,
  blogIds: string[]
): Promise<DiscoverySuggestion[]> {
  // Expire existing pending suggestions
  await db
    .update(discoverySuggestions)
    .set({ status: "expired" } as Partial<typeof discoverySuggestions.$inferInsert>)
    .where(
      and(
        eq(discoverySuggestions.userId, userId),
        eq(discoverySuggestions.status, "pending")
      )
    );

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h from now

  const rows = await db
    .insert(discoverySuggestions)
    .values(blogIds.map((blogId) => ({ userId, blogId, expiresAt })))
    .returning();

  return rows;
}

/**
 * Get pending (non-expired) suggestions for a user, enriched with blog data.
 */
export async function getPendingSuggestions(userId: string): Promise<
  Array<DiscoverySuggestion & { blog: Blog }>
> {
  const rows = await db
    .select({
      suggestion: discoverySuggestions,
      blog: blogs,
    })
    .from(discoverySuggestions)
    .innerJoin(blogs, eq(discoverySuggestions.blogId, blogs.id))
    .where(
      and(
        eq(discoverySuggestions.userId, userId),
        eq(discoverySuggestions.status, "pending"),
        sql`${discoverySuggestions.expiresAt} > now()`
      )
    );

  return rows.map((r) => ({ ...r.suggestion, blog: r.blog }));
}

/**
 * Mark a suggestion as confirmed or rejected.
 */
export async function updateSuggestionStatus(
  suggestionId: string,
  status: "confirmed" | "rejected"
): Promise<void> {
  await db
    .update(discoverySuggestions)
    .set({ status })
    .where(eq(discoverySuggestions.id, suggestionId));
}

/**
 * Mark multiple suggestions as confirmed.
 */
export async function confirmSuggestions(suggestionIds: string[]): Promise<void> {
  await db
    .update(discoverySuggestions)
    .set({ status: "confirmed" })
    .where(inArray(discoverySuggestions.id, suggestionIds));
}

// ─── Reading Calendar ─────────────────────────────────────────────────────────

/**
 * Add confirmed blogs to the reading calendar.
 */
export async function addToCalendar(
  entries: NewReadingCalendarEntry[]
): Promise<ReadingCalendarEntry[]> {
  return db.insert(readingCalendar).values(entries).returning();
}

/**
 * Fetch a user's calendar entries for a given week (Mon–Sun).
 */
export async function getCalendarWeek(
  userId: string,
  weekOf: string // YYYY-MM-DD (Monday)
): Promise<Array<ReadingCalendarEntry & { blog: Blog }>> {
  const monday = new Date(weekOf);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const mondayStr = monday.toISOString().slice(0, 10);
  const sundayStr = sunday.toISOString().slice(0, 10);

  const rows = await db
    .select({
      entry: readingCalendar,
      blog: blogs,
    })
    .from(readingCalendar)
    .innerJoin(blogs, eq(readingCalendar.blogId, blogs.id))
    .where(
      and(
        eq(readingCalendar.userId, userId),
        sql`${readingCalendar.scheduledDate} >= ${mondayStr}`,
        sql`${readingCalendar.scheduledDate} <= ${sundayStr}`
      )
    );

  return rows.map((r) => ({ ...r.entry, blog: r.blog }));
}

/**
 * Check if a blog is already in a user's active calendar (status != skipped).
 * Used to prevent duplicate manual imports.
 */
export async function isInCalendar(userId: string, blogId: string): Promise<boolean> {
  const rows = await db
    .select({ id: readingCalendar.id })
    .from(readingCalendar)
    .where(
      and(
        eq(readingCalendar.userId, userId),
        eq(readingCalendar.blogId, blogId),
        sql`${readingCalendar.status} != 'skipped'`
      )
    )
    .limit(1);
  return rows.length > 0;
}

/**
 * Store or update the raw article content for a blog row.
 */
export async function updateBlogRawContent(blogId: string, rawContent: string): Promise<void> {
  await db
    .update(blogs)
    .set({ rawContent })
    .where(eq(blogs.id, blogId));
}

/**
 * Fetch a blog row by URL. Returns null if not found.
 */
export async function getBlogByUrl(url: string): Promise<Blog | null> {
  const [row] = await db.select().from(blogs).where(eq(blogs.url, url)).limit(1);
  return row ?? null;
}

/**
 * Update the read/skipped status of a calendar entry.
 */
export async function updateCalendarStatus(
  entryId: string,
  status: "read" | "skipped"
): Promise<void> {
  await db
    .update(readingCalendar)
    .set({ status })
    .where(eq(readingCalendar.id, entryId));
}
