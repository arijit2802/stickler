// ─── Blog Discovery & Reading Calendar — Type Definitions ─────────────────────

/** A single blog candidate returned by Tavily search + Claude ranking. */
export interface BlogCandidate {
  url: string;
  title: string;
  source: string;
  summary: string;
  author: string | null;
  publishedAt: string | null; // ISO date string
  estimatedReadMin: number | null;
}

/** A suggestion presented to the user (includes the DB suggestion id). */
export interface SuggestionItem {
  suggestionId: string;
  blogId: string;
  url: string;
  title: string;
  source: string;
  summary: string;
  author: string | null;
  estimatedReadMin: number | null;
  expiresAt: string; // ISO date string
}

/** Response from POST /api/discovery/run */
export interface RunDiscoveryResponse {
  suggestions: SuggestionItem[];
}

/** Response from GET /api/discovery/suggestions */
export interface GetSuggestionsResponse {
  suggestions: SuggestionItem[];
}

/** Body for POST /api/discovery/confirm */
export interface ConfirmDiscoveryBody {
  suggestionIds: string[]; // IDs of DiscoverySuggestion rows to confirm
  scheduledDate: string;   // ISO date string (YYYY-MM-DD) — typically tomorrow
}

/** Body for POST /api/discovery/reject */
export interface RejectDiscoveryBody {
  suggestionId: string; // Single suggestion to reject
}

/** Response from POST /api/discovery/reject — replacement suggestion */
export interface RejectDiscoveryResponse {
  replacement: SuggestionItem | null; // null if no replacement found
}

/** A reading calendar entry enriched with blog details. */
export interface CalendarEntry {
  entryId: string;
  scheduledDate: string; // YYYY-MM-DD
  status: "pending" | "read" | "skipped";
  blog: {
    id: string;
    url: string;
    title: string;
    source: string | null;
    summary: string | null;
    author: string | null;
    estimatedReadMin: number | null;
  };
}

/** Response from GET /api/calendar */
export interface GetCalendarResponse {
  entries: CalendarEntry[];
  weekOf: string; // ISO date of Monday for the requested week
}
