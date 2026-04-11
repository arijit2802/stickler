# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> Keep this file lean. If Claude already does it correctly without the rule, delete the rule.

---

## Project Overview

```
Project Name  : Stickler
Type          : Web Application
Stage         : MVP
Owner         : Arijit
Description   : A blog scanner across popular blog sites that suggests blogs based on
                user preferences, helping users grow breadth and depth in their interest
                areas through an agentic learning workflow.
```

---

## Top-Level Features

| # | Feature | Status |
|---|---|---|
| 1 | User Onboarding Interview (agentic interest profiling) | DONE |
| 2 | Agentic Blog Discovery & Reading Calendar | DONE |
| 3 | Blog Summarisation, Keywords & Learning Shorts | DONE |
| 4 | Blog Q&A and Feedback Loop | PLANNED |
| 5 | Recurring Learn Workflow (every 3 days) | PLANNED |
| 6 | Monthly Knowledge Assessment & Benchmarking | PLANNED |
| 7 | Home Dashboard (returning-user landing page) | DONE |

---

## Tech Stack

```
Frontend      : Next.js 14, TypeScript (strict), Tailwind CSS
Backend       : Next.js API Routes + Python FastAPI (AI/agent services)
Database      : PostgreSQL
Auth          : NextAuth.js v5 (Auth.js) — credentials provider, JWT sessions
AI            : Anthropic Claude API (agentic flows)
Search        : Tavily Search
Testing       : Vitest, Playwright
Deployment    : Vercel (frontend), Railway (FastAPI)
Package Mgr   : pnpm
Language      : TypeScript strict (frontend/API), Python 3.11+ (AI services)
```

> ⚠️ Tech stack above contains assumptions — confirm before first build session.

---

## File Structure

```
src/
  api/          → Route handlers only (no business logic)
  services/     → Business logic and external integrations
  models/       → Database queries and schemas
  components/   → UI components
  utils/        → Shared helpers and utilities
  types/        → TypeScript type definitions

SPECS/
  active/       → Current feature being built (ONE at a time)
  planned/      → Upcoming specs not yet in development
  done/         → Completed specs (never reference these)
  archived/     → Deprecated approaches (never reference these)

BUGS/
  open/         → Active defect reports (BUG-XXX-slug.md)
  fixed/        → Resolved bugs (never reference these)

.claude/
  commands/     → Custom slash commands
```

---

## Code Style Rules

- Use **TypeScript strict mode** everywhere
- Prefer `async/await` over `.then()` chains
- All exported functions must have **JSDoc comments**
- Use **Zod** for all input validation (never trust raw input)
- Use **named exports** — avoid default exports except for pages/components
- Max function length: **50 lines** — extract if longer
- No `any` type — use `unknown` and narrow it

---

## Hard Constraints

- **NEVER** modify files in `/db/migrations` directly — create new migrations only
- **NEVER** use `console.log` in production code — use the logger utility
- **NEVER** mix patterns from old specs with new ones — ask if unclear
- **NEVER** install new packages without confirming first

---

## MCP Servers

| Server | Purpose | Usage |
|---|---|---|
| **context7** | Live library docs | Add `use context7` to any prompt |
| **sequential-thinking** | Complex reasoning | Auto-triggered for architecture tasks |
| **memory** | Persist decisions | Stores key decisions across sessions |
| **github** | Issues & PRs | Reference issues by number: `fix #42` |
| **playwright** | E2E testing | Auto-run tests after feature completion |
| **TavilySearch** | Blog/web search | Used by agentic blog discovery workflow |

---

## Working with Specs

### Rules
- There is always **ONE active spec** at a time in `SPECS/active/`
- Next spec to build lives in `SPECS/planned/` — move to `active/` when ready
- When a feature is done → move spec to `SPECS/done/` → update this file
- **Start a NEW session** when switching to a new spec
- If you see conflicting patterns between specs, **stop and ask**
- **DO NOT regenerate initial specs** unless a new top-level feature is added

### Spec Lifecycle
```
1. Write spec → save to SPECS/planned/feature-name.md
2. When ready → move to SPECS/active/
3. New session → implement spec → tests pass
4. Mark spec DONE → move to SPECS/done/
5. Update CLAUDE.md with new patterns
6. Repeat
```

### Spec File Header (required on every spec)
```markdown
---
feature  : [Feature Name]
status   : ACTIVE          ← ACTIVE | DONE | DEPRECATED
created  : YYYY-MM-DD
completed: —
replaces : none
---
```

---

## Role & Approach

```
ROLE: Solution architect and seasoned full-stack engineer

When building specs:
- Build detailed specs for each top-level feature
- Ask for spec approval before implementation
- Review changes for vulnerability, resilience, scalability, availability

Output format: Modified files only, with inline comments explaining changes

Before responding, confirm:
☐ Does the output match the format requested?
☐ Does it follow the code style rules in CLAUDE.md?
☐ Are there any assumptions I should know about?
```

---

## Feature Development Workflow

```
Step 1 — SPEC SESSION
"Read CLAUDE.md. I want to build [feature].
Interview me about technical design, edge cases, and tradeoffs.
Then write a complete spec to SPECS/active/[feature-name].md"

Step 2 — BUILD SESSION (new session)
"Read CLAUDE.md and SPECS/active/[feature-name].md only.
Implement the feature as specced. Work file by file.
Pause after each file for confirmation."

Step 3 — TEST SESSION (new session)
"Read CLAUDE.md. Write and run tests for [feature].
Cover: happy path, edge cases, error states."

Step 4 — WRAP UP
- Move spec to SPECS/done/
- Update CLAUDE.md top-level feature status and patterns below
```

---

## Session Rules

1. **Always read this file first** before starting any task
2. **New feature = new session** — never carry old context into new work
3. **Ask before assuming** — if spec is unclear, ask one clarifying question
4. **Flag conflicts** — if you see patterns that contradict each other, stop and ask
5. **Don't over-read** — only read files relevant to the current task

---

## Post-Execution Summary (REQUIRED)

After **every task**, output this block before ending your response:

```
---
### Thought Process & Analysis
- What I understood from the prompt
- Key decisions I made and why
- Alternatives I considered but rejected
- Assumptions I made (flag these clearly)

### Token Usage Estimate
- Input tokens  : ~[number]
- Output tokens : ~[number]
- Total         : ~[number]
- Biggest token consumers: [list]

### Prompt Optimization Suggestions
- Redundant parts in your prompt
- Vague instructions that caused me to guess
- Context I processed but didn't need

**Leaner Version of Your Prompt:**
[Rewrite the prompt in the most concise form that achieves the same result]
Estimated token saving: ~[X]%
---
```

---

## Established Patterns

### Feature 1 — User Onboarding Interview
- **Auth**: NextAuth.js v5 middleware gates all routes; `resolveDbUser()` in `src/utils/api-helpers.ts` maps session email → DB user
- **Session state**: Stored in `onboarding_sessions` DB table (no Redis needed for MVP); updated after every turn via `src/models/onboarding.ts`
- **Agent pattern**: Direct Anthropic SDK (`claude-sonnet-4-6`) + thin state machine in `src/services/onboarding-agent.ts`; NO LangGraph for linear flows
- **Profile completion signal**: Claude emits `PROFILE_COMPLETE: {...json}` marker; service parses it and strips it before showing to user
- **Vague answer detection**: `isVague()` checks word count < 5 and trigger phrases; clarification counter per step, max 3 before forced advance
- **Input sanitisation**: `sanitise()` in `src/utils/api-helpers.ts` strips HTML tags before passing to service
- **DB ORM**: Drizzle ORM with `postgres` driver; schema in `db/schema.ts`; run `npm run db:generate && npm run db:migrate` for migrations
- **Logging**: Pino logger via `src/utils/logger.ts`; never use `console.log`
- **Error handling**: All API errors return `{ error: string }` via `errorResponse()` helper

### Feature 2 — Agentic Blog Discovery & Reading Calendar
- **Discovery pipeline**: `runDiscovery(userId)` in `src/services/blog-discovery.ts` — generates queries via Claude → searches via Tavily → ranks/deduplicates → persists as `discovery_suggestions`
- **Tavily client**: `@tavily/core` SDK; API key via `TAVILY_API_KEY` env var; `includeDomains` filter targets known blog sources
- **Staging state**: Suggestions land in `discovery_suggestions` table with `status=pending` and 24h expiry; confirmed → `reading_calendar`, rejected → trigger replacement search
- **Dedup**: `getSeenUrls(userId)` checks all URLs already in the user's reading calendar; new suggestions filtered against this set
- **Fallback**: If Tavily returns < 3 results, broadens query to `topic1 OR topic2 blog` and retries once
- **Calendar service**: `src/services/calendar.ts` — `confirmAndSchedule()`, `getWeek()`, `markStatus()`; calendar entries keyed by `scheduled_date` (DATE column)
- **UI flow**: `/discovery` server component auto-runs discovery if no pending suggestions; on confirm → router.push(`/calendar`)
- **Onboarding redirect**: After profile save, users redirect to `/discovery` (not `/dashboard`)

### Feature 3 — Blog Summarisation, Keywords & Learning Shorts
- **Processing pipeline**: `processBlog(blogId)` in `src/services/summarisation.ts` — Tavily extract → Claude (summary bullets, keywords, learning short) → `blog_summaries` table
- **Content fetch**: Tavily `extract()` for full article; falls back to `rawContent` in `blogs` table if extract fails; marks `unprocessable` if < 100 chars
- **Claude outputs**: 3 parallel-friendly calls — `generateSummary()`, `extractKeywords()`, `writeLearningShort()`; each retries once on JSON parse failure
- **Audio**: `src/services/audio.ts` is a stub returning null (no TTS provider); frontend `BlogSummaryCard` uses browser `speechSynthesis` as fallback
- **Status machine**: `none → processing → done | unprocessable` in `blog_summaries.status`; guard prevents duplicate concurrent runs
- **Auto-trigger**: `POST /api/discovery/confirm` fires `processBlog()` for each confirmed blog as a fire-and-forget background call (non-blocking)
- **UI**: `BlogSummaryCard` component with 3 tabs (Summary / Keywords / Learning Short) + browser TTS play button
- **No new packages**: `@tavily/core` already installed from Feature 2; no ElevenLabs SDK added (not yet confirmed)

### Feature 7 — Home Dashboard
- **Root routing**: `app/page.tsx` checks `profile?.isConfirmed` — returning users go to `/home`, new users to `/onboarding`
- **Home page**: `app/home/page.tsx` server component — guards auth + profile, fetches `getWeek()` server-side, no loading flash
- **HomeDashboard component**: `src/components/HomeDashboard.tsx` — client component with inline read/skip controls (same PATCH `/api/calendar` endpoint as ReadingCalendar); empty-state links to `/discovery`
- **No new APIs or DB tables**: reuses `getWeek()`, `getProfile()`, and existing `/api/calendar` PATCH

### Observability — OpenTelemetry
- **SDK boot**: `instrumentation.ts` at root (Next.js hook) → calls `registerTelemetry()` in `src/utils/telemetry.ts` on server start
- **Log-trace correlation**: `src/utils/logger.ts` injects `traceId` + `spanId` into every Pino record in production
- **Export**: Dev → console. Prod → OTLP HTTP (`OTEL_EXPORTER_OTLP_ENDPOINT`). Works with SigNoz, Jaeger, Grafana Tempo
- **Security**: No PII in spans; endpoint + auth header via env vars only (`OTEL_EXPORTER_OTLP_HEADERS`)
- **Auto-instrumented**: HTTP, PostgreSQL queries, fetch calls — no manual spans needed for basic coverage
- **Health check**: `GET /api/health` — liveness + DB readiness, safe to expose publicly
- **Never add user message content to span attributes** — PII risk

---

## Commands

```bash
npm run dev          # start dev server
npm run build        # production build
npm run lint         # ESLint
npm run test         # Vitest unit tests
npm run test:watch   # Vitest in watch mode
npm run test:e2e     # Playwright E2E tests
npm run db:generate  # generate Drizzle migration from schema changes
npm run db:migrate   # apply pending migrations
npm run db:studio    # open Drizzle Studio (DB GUI)
```

Run a single unit test:
```bash
npx vitest run tests/unit/onboarding-agent.test.ts
```

---

## Change Log

| Date | Feature | Notes |
|---|---|---|
| 2026-03-21 | Project init | CLAUDE.md created, scaffold generated, all 6 specs written |
| 2026-03-21 | Feature 1: User Onboarding Interview | Implemented: Next.js 14, Drizzle ORM, NextAuth.js, Anthropic SDK, Zod |
| 2026-03-23 | Observability | OpenTelemetry SDK, Pino log-trace correlation, /api/health endpoint |
| 2026-04-01 | Feature 2: Blog Discovery & Reading Calendar | Tavily search, Claude query gen, dedup, staging suggestions, weekly calendar |
| 2026-04-02 | Feature 3: Blog Summarisation & Learning Shorts | Claude summary/keywords/script, Tavily extract, browser TTS, BlogSummaryCard |
| 2026-04-04 | Feature 7: Home Dashboard | Returning-user landing page, profile-based routing, inline read/skip controls |
