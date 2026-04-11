import { logger } from "@/src/utils/logger";
import {
  addToCalendar,
  getCalendarWeek,
  updateCalendarStatus,
  confirmSuggestions,
} from "@/src/models/discovery";
import type { CalendarEntry } from "@/src/types/discovery";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Return the ISO date string (YYYY-MM-DD) for tomorrow.
 */
export function tomorrow(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Return the ISO date string (YYYY-MM-DD) for the Monday of the given date.
 * Defaults to the current week if no date provided.
 */
export function getMondayOf(dateStr?: string): string {
  const d = dateStr ? new Date(dateStr) : new Date();
  const day = d.getDay(); // 0=Sun, 1=Mon, …
  const diff = day === 0 ? -6 : 1 - day; // shift to Monday
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

// ─── Service Functions ────────────────────────────────────────────────────────

/**
 * Confirm selected suggestions and add their blogs to the reading calendar.
 * Marks suggestion rows as confirmed, then creates calendar entries.
 */
export async function confirmAndSchedule(
  userId: string,
  suggestionIds: string[],
  blogIds: string[],
  scheduledDate: string
): Promise<CalendarEntry[]> {
  if (suggestionIds.length !== blogIds.length) {
    throw new Error("suggestionIds and blogIds arrays must be the same length");
  }

  await confirmSuggestions(suggestionIds);

  const entries = await addToCalendar(
    blogIds.map((blogId) => ({ userId, blogId, scheduledDate }))
  );

  logger.info(
    { userId, count: entries.length, scheduledDate },
    "Blogs added to reading calendar"
  );

  // Return lightweight shape — caller can re-fetch full entries via getWeek
  return entries.map((e) => ({
    entryId: e.id,
    scheduledDate: e.scheduledDate,
    status: (e.status ?? "pending") as "pending" | "read" | "skipped",
    blog: { id: e.blogId, url: "", title: "", source: null, summary: null, author: null, estimatedReadMin: null },
  }));
}

/**
 * Fetch the enriched reading calendar for a user for a given week.
 */
export async function getWeek(
  userId: string,
  weekOf?: string
): Promise<{ entries: CalendarEntry[]; weekOf: string }> {
  const monday = getMondayOf(weekOf);
  const rows = await getCalendarWeek(userId, monday);

  const entries: CalendarEntry[] = rows.map((r) => ({
    entryId: r.id,
    scheduledDate: r.scheduledDate,
    status: (r.status ?? "pending") as "pending" | "read" | "skipped",
    blog: {
      id: r.blog.id,
      url: r.blog.url,
      title: r.blog.title,
      source: r.blog.source,
      summary: r.blog.summary,
      author: r.blog.author,
      estimatedReadMin: r.blog.estimatedReadMin,
    },
  }));

  return { entries, weekOf: monday };
}

/**
 * Mark a calendar entry as read or skipped.
 */
export async function markStatus(
  entryId: string,
  status: "read" | "skipped"
): Promise<void> {
  await updateCalendarStatus(entryId, status);
  logger.info({ entryId, status }, "Calendar entry status updated");
}
