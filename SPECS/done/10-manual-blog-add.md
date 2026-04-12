---
feature  : Manual Blog Add (URL Import)
status   : DONE
created  : 2026-04-11
completed: 2026-04-11
replaces : none
---

# Feature 10 — Manual Blog Add (URL Import)

## Goal
Allow users to add any blog or article of their choice by pasting a URL, which is validated (reachable, not a 404), enriched via Tavily extract, and added directly to the reading calendar — alongside the agentic discovery flow.

---

## User Stories

- As a user, I want to paste a URL and add it to my reading calendar so I can track articles I find myself outside of the discovery flow.
- As a user, I want to be told immediately if a URL is broken (404 or unreachable) so I don't add dead links.
- As a user, I want the article's title, source, and estimated read time pre-filled automatically so I don't have to type them manually.
- As a user, I want to choose which date to schedule the article on.

---

## Interaction Flow

```
1. User opens "Add article" entry point (button on /home, /calendar, or /discovery)
2. UI shows a modal / inline form with a URL input field
3. User pastes URL and clicks "Check link"
4. Client calls POST /api/blogs/import/validate
   a. Server performs HEAD request to the URL (3s timeout)
   b. If status 404 or connection fails → return error { valid: false, reason }
   c. If reachable → call Tavily extract to get title, source, author, estimated read time
   d. Return { valid: true, meta: { title, source, author, estimatedReadMin, url } }
5. UI shows pre-filled metadata for user to confirm (title editable)
6. User picks a scheduled date (date picker, defaults to tomorrow)
7. User clicks "Add to Calendar"
8. Client calls POST /api/blogs/import/add with { url, title, source, scheduledDate }
9. Server upserts blog row, creates reading_calendar entry
10. Triggers processBlog() fire-and-forget (same as discovery confirm)
11. UI navigates to /calendar or shows success toast
```

---

## Data Model

No new tables. Reuses existing:

- `blogs` — upsert on `url` (unique constraint already exists); populate `title`, `source`, `author`, `estimatedReadMin`
- `reading_calendar` — insert new entry with `userId`, `blogId`, `scheduledDate`, `status = 'pending'`

**One new constraint to handle:** a user should not add the same URL twice to their active calendar. Check `reading_calendar` for an existing entry with this `blogId` and `status != 'skipped'` before inserting.

---

## API Routes

| Method | Route | Description |
|---|---|---|
| POST | `/api/blogs/import/validate` | Validate URL reachability + extract metadata via Tavily |
| POST | `/api/blogs/import/add` | Upsert blog + add to reading calendar + trigger processing |

---

## Service Layer

### `src/services/blog-import.ts` (new)
- `validateUrl(url)` — HEAD request with 3s timeout; returns `{ reachable: boolean, statusCode?: number }`
- `enrichBlogMeta(url)` — Tavily extract; returns `{ title, source, author, estimatedReadMin }` or null if extract fails (graceful fallback to URL-derived title)
- `importBlog(userId, url, title, source, scheduledDate)` — upsert blog, check for duplicate calendar entry, insert calendar row, fire `processBlog()`

### `src/components/AddBlogModal.tsx` (new)
Client component — modal with:
- URL input + "Check link" button (calls validate endpoint)
- Metadata preview (title editable, source/read-time shown)
- Date picker (defaults to tomorrow)
- "Add to Calendar" button (calls add endpoint)
- Error state for 404 / unreachable

### Entry points (small additions)
- `/home` — "Add article" button in the Quick Actions row
- `/calendar` — "+ Add article" link next to "Discover blogs"

---

## Validation Rules

| Rule | Detail |
|---|---|
| URL format | Must start with `http://` or `https://`; reject others before making any request |
| Reachability | HEAD request with 3s timeout; follow up to 3 redirects |
| 404 / 4xx | Show: "This page doesn't exist (404). Please check the URL." |
| 5xx / timeout | Show: "Couldn't reach this page. The site may be down — try again later." |
| Duplicate in calendar | Show: "This article is already in your calendar." Block add. |
| Tavily extract fails | Still allow add — use URL hostname as `source`, URL path as fallback title; user can edit title manually |

---

## Edge Cases

| Case | Handling |
|---|---|
| URL returns 404 | Validate endpoint returns `{ valid: false, reason: "Page not found (404)" }`; UI shows error; "Add to Calendar" disabled |
| URL unreachable (timeout) | Returns `{ valid: false, reason: "Site unreachable" }`; same error UI |
| URL redirects (301/302) | Follow redirects; validate the final destination URL; store the final URL in DB |
| Same URL already in `blogs` table | Upsert is idempotent; skip re-extraction if `rawContent` already present |
| Same URL already in user's calendar | Return `{ valid: true, duplicate: true }`; UI warns user and blocks add |
| Tavily rate limit | Catch error; fallback to hostname-derived metadata; proceed with add |
| User edits title before adding | Use the user-provided title in the DB, not the extracted one |
| Very long URL / non-article page | Tavily extract may return little content; still add — `processBlog()` will mark `unprocessable` if content too short |
| Scheduled date in the past | Allow it — users may want to log articles they already read |

---

## Acceptance Criteria

- [ ] "Add article" entry point visible on `/home` Quick Actions and `/calendar` header
- [ ] URL input validates format client-side before making any network call
- [ ] `POST /api/blogs/import/validate` returns error for 404 URLs; "Add to Calendar" button stays disabled
- [ ] `POST /api/blogs/import/validate` returns error for unreachable / timed-out URLs
- [ ] Valid URLs show pre-filled title, source, and estimated read time
- [ ] Title is editable before adding
- [ ] Date picker defaults to tomorrow; user can change it
- [ ] `POST /api/blogs/import/add` upserts blog and creates calendar entry
- [ ] Duplicate URL in active calendar is detected and blocked with a clear message
- [ ] `processBlog()` triggered fire-and-forget after successful add
- [ ] Redirect URLs: final destination URL stored, not the original redirect
- [ ] Success navigates to `/calendar` or shows toast confirmation
