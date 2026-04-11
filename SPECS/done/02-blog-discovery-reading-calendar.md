---
feature  : Agentic Blog Discovery & Reading Calendar
status   : DONE
created  : 2026-03-21
completed: 2026-04-01
replaces : none
---

# Feature 2 — Agentic Blog Discovery & Reading Calendar

## Goal
After onboarding, an agentic workflow searches popular blog platforms for content matching the user's Learning Profile. It surfaces 3 blogs per day, adds them to a reading calendar, and asks the user for confirmation before saving.

---

## User Stories

- As a user, I want 3 relevant blogs suggested to me each day based on my interests.
- As a user, I want to approve, reject, or ask for alternatives before blogs are added to my calendar.
- As a user, I want to see my upcoming reading schedule in a calendar view.

---

## Agentic Discovery Flow

```
1. Read user's Learning Profile (interests, depth, knowledge level)
2. Generate 3 search queries via Claude (tailored to user's profile)
3. Execute searches via Tavily Search across blog sources
4. Score and rank results (relevance, recency, reading time)
5. Deduplicate against already-seen/read articles
6. Present top 3 to user with: title, source, summary (2 sentences), estimated read time
7. User action:
   a. Approve all → add to calendar for tomorrow
   b. Reject one → search for replacement
   c. Search more → re-run discovery
8. Confirmed blogs saved to reading calendar
```

### Blog Sources to Search
- Medium, Substack, Dev.to, Hacker News,OpenAI blog , Google Deepmind blog , Anthropic blog, Hugging face blogs, KD Nuggets, Daily dose of data sceince personal tech blogs (via Tavily)

---

## Data Model

### `blogs` table
```sql
id              UUID PRIMARY KEY
url             TEXT UNIQUE NOT NULL
title           TEXT NOT NULL
source          TEXT            -- medium / substack / devto / etc.
summary         TEXT
author          TEXT
published_at    TIMESTAMPTZ
estimated_read_min INT
raw_content     TEXT
created_at      TIMESTAMPTZ DEFAULT now()
```

### `reading_calendar` table
```sql
id              UUID PRIMARY KEY
user_id         UUID REFERENCES users(id)
blog_id         UUID REFERENCES blogs(id)
scheduled_date  DATE NOT NULL
status          TEXT DEFAULT 'pending'  -- pending | read | skipped
added_at        TIMESTAMPTZ DEFAULT now()
```

### `search_queries` table (audit/dedup)
```sql
id          UUID PRIMARY KEY
user_id     UUID REFERENCES users(id)
query       TEXT
ran_at      TIMESTAMPTZ DEFAULT now()
result_urls TEXT[]
```

---

## API Routes

| Method | Route | Description |
|---|---|---|
| POST | `/api/discovery/run` | Trigger blog discovery for user |
| GET  | `/api/discovery/suggestions` | Get current pending suggestions |
| POST | `/api/discovery/confirm` | Confirm selected blogs → add to calendar |
| POST | `/api/discovery/reject` | Reject a suggestion, get replacement |
| GET  | `/api/calendar` | Get reading calendar (paginated by week) |

---

## Service Layer

### `BlogDiscoveryService` (`src/services/blog-discovery.ts`)
- `generateSearchQueries(profile)` → call Claude to produce 3 targeted queries
- `searchBlogs(queries)` → call Tavily Search, return raw results
- `rankAndFilter(results, userId)` → score, deduplicate, return top 3
- `saveSuggestions(userId, blogs)` → persist to staging state

### `CalendarService` (`src/services/calendar.ts`)
- `addToCalendar(userId, blogIds, date)` → insert into `reading_calendar`
- `getCalendar(userId, weekOf)` → fetch scheduled blogs for a week
- `markStatus(entryId, status)` → mark as read/skipped

---

## Edge Cases

| Case | Handling |
|---|---|
| Tavily returns < 3 results | Broaden query (remove 1 filter), retry once |
| All results already seen | Expand to adjacent topics from user profile |
| User rejects all 3 | Re-run with different query strategy (more specific or broader) |
| User never confirms | Suggestions expire after 24h; auto-suggest next day |
| Duplicate URL across days | Blocked by dedup check against `reading_calendar` |

---

## Acceptance Criteria

- [ ] Discovery workflow runs and returns 3 blog suggestions
- [ ] Suggestions deduplicated against user's history
- [ ] User can approve, reject individual items, or request more
- [ ] Confirmed blogs appear in reading calendar for next day
- [ ] Calendar view shows week's reading schedule
- [ ] Tavily failure handled gracefully with user-facing message
- [ ] Unit tests: `BlogDiscoveryService` (dedup, ranking, fallback)
- [ ] E2E: discovery → confirm → calendar view
