// ─── Manual Blog Import — Type Definitions ────────────────────────────────────

/** Metadata extracted from a URL via Tavily. */
export interface BlogMeta {
  url: string; // final URL after redirects
  title: string;
  source: string; // hostname e.g. "medium.com"
  author: string | null;
  estimatedReadMin: number | null;
}

/** Response from POST /api/blogs/import/validate */
export interface ValidateUrlResponse {
  valid: boolean;
  reason?: string; // present when valid=false
  duplicate?: boolean; // true when URL already in user's active calendar
  meta?: BlogMeta; // present when valid=true
}

/** Request body for POST /api/blogs/import/add */
export interface ImportBlogBody {
  url: string;
  title: string;
  source: string;
  scheduledDate: string; // YYYY-MM-DD
}

/** Response from POST /api/blogs/import/add */
export interface ImportBlogResponse {
  blogId: string;
  entryId: string;
  scheduledDate: string;
}
