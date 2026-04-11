---
feature  : Home Dashboard
status   : DONE
created  : 2026-04-04
completed: 2026-04-04
replaces : none
---

# Feature 7 — Home Dashboard

## Goal
Returning users who have already completed onboarding and saved a Learning Profile should land on a personalised Home Dashboard — not the onboarding page. The dashboard shows this week's reading calendar entries with their status, and provides quick-access navigation to Discovery, the full Calendar, and Profile update.

---

## User Stories

- As a returning user, I want to land on a dashboard after sign-in so I don't have to navigate through onboarding each time.
- As a user, I want to see my reading list for the current week with read/pending/skipped status at a glance.
- As a user, I want one-click access to find new blogs (Discovery), see the full calendar, or update my interests.
- As a new user (no profile yet), I want to be routed to onboarding as before.

---

## Routing Flow

```
1. User signs in → root `/` page server component runs
2. Check if authenticated (NextAuth session)
   a. No session → redirect to /sign-in  (unchanged)
3. If session exists → check DB for completed Learning Profile
   a. No profile (new user) → redirect to /onboarding  (unchanged)
   b. Profile exists (returning user) → redirect to /home  (NEW)
4. /home server component:
   a. Resolves DB user via resolveDbUser()
   b. Fetches current week's calendar entries via getWeek(userId, currentMonday)
   c. Renders HomeDashboard client component with initial data
```

---

## Data Model

No new tables required. Reads from existing:

- `learning_profiles` — to detect if profile exists for redirect guard
- `reading_calendar` — to show this week's entries (already served by `getWeek()` in `src/services/calendar.ts`)
- `blogs` — joined via reading_calendar for title, url, source

---

## API Routes

No new API routes required. The home page uses existing endpoints:

| Method | Route | Description |
|---|---|---|
| GET | `/api/calendar?weekOf=YYYY-MM-DD` | Already exists — fetches week entries |
| PATCH | `/api/calendar` | Already exists — mark read/skipped |

---

## New Pages & Components

### `app/home/page.tsx` (Server Component)
- Auth-guards: no session → `/sign-in`, no profile → `/onboarding`
- Fetches current week's calendar via `getWeek()`
- Renders `<HomeDashboard initial={calendarData} />`

### `src/components/HomeDashboard.tsx` (Client Component)
Sections:
1. **Header** — greeting with user's role from profile (e.g. "Welcome back, ML Engineer")
2. **This Week** — inline reading list: title, source, status badge (read / pending / skipped), link to article; uses same mark-as-read/skipped controls as `ReadingCalendar`
3. **Quick Actions** — three cards/buttons:
   - "Find New Blogs" → `/discovery`
   - "Full Calendar" → `/calendar`
   - "Update Interests" → `/onboarding` (redo interview)

### `app/page.tsx` (updated)
Change redirect logic:
- Authenticated + profile exists → `/home`
- Authenticated + no profile → `/onboarding`
- Not authenticated → `/sign-in`

---

## Service Layer

### `src/models/onboarding.ts` (existing)
Reuse `getProfile(userId)` — already exists; returns `null` if no profile saved.

### `src/services/calendar.ts` (existing)
Reuse `getWeek(userId, weekOf)` — already exists; call with current Monday.

### `src/utils/api-helpers.ts` (existing)
Reuse `resolveDbUser()` for server component auth.

No new service functions needed.

---

## Edge Cases

| Case | Handling |
|---|---|
| User has profile but no calendar entries this week | Show empty-state message: "No blogs scheduled this week. Go find some!" with link to /discovery |
| User navigates directly to /onboarding with existing profile | Allow — this is the intended "redo interview" path; no change to onboarding behaviour |
| Session expires mid-page | NextAuth middleware redirects to /sign-in |
| Calendar fetch fails | Show error banner in HomeDashboard; page still renders with nav actions available |

---

## Acceptance Criteria

- [ ] Authenticated user with a saved profile lands on `/home` after sign-in (not `/onboarding`)
- [ ] New user (no profile) still redirects to `/onboarding` as before
- [ ] `/home` shows all reading calendar entries for the current week with correct status badges
- [ ] Mark-as-read and Skip controls work inline on the home page (same behaviour as `/calendar`)
- [ ] "Find New Blogs" button navigates to `/discovery`
- [ ] "Full Calendar" button navigates to `/calendar`
- [ ] "Update Interests" button navigates to `/onboarding`
- [ ] Empty state shown when no entries exist for the current week
- [ ] Page is server-rendered with initial calendar data (no loading flash for the week list)
- [ ] No new DB tables or migrations required
