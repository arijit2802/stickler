---
id       : BUG-001
title    : Keywords tab always blank in BlogSummaryCard
status   : FIXED
severity : high
feature  : /calendar, /home — BlogSummaryCard Keywords tab
created  : 2026-04-10
fixed    : 2026-04-11
---

## Observed Behaviour
The Keywords tab in `BlogSummaryCard` is always empty — no terms or definitions are shown, even for blogs that have been successfully summarised and show bullets in the Summary tab.

## Expected Behaviour
5–7 key terms extracted from the blog article, each with a one-sentence plain-English definition.

## Steps to Reproduce
1. Sign in and navigate to `/calendar`
2. Open a blog's summary card (status = done)
3. Click the **Keywords** tab
4. Tab is blank — no keywords shown

## Screenshot
none

## Root Cause Hypothesis

**Two-part root cause:**

**Part 1 — Parse failure (primary, now fixed in code):**
`extractKeywords()` in `src/services/summarisation.ts` called `JSON.parse(block.text)` directly. Claude `claude-sonnet-4-6` frequently wraps JSON responses in markdown code fences (` ```json\n...\n``` `), causing `JSON.parse` to throw. The `catch` block silently returned `[]`, so an empty array was stored in `blog_summaries.keywords`.

Fix applied this session: strip code fences before parsing —
```ts
const text = block.text.replace(/^```(?:json)?\s*/m, "").replace(/\s*```\s*$/m, "").trim();
```

**Part 2 — Stale DB data (outstanding):**
All blogs processed before the fix have `keywords = []` persisted in the `blog_summaries` table. `processBlog()` guards with `if (existing?.status === "done") return existing` — so existing rows are never reprocessed. These blogs will continue showing blank keywords until reprocessed.

## Fix Scope
- [x] `src/services/summarisation.ts` — code fence stripping applied
- [x] Existing `blog_summaries` rows with `keywords = '[]'` — handled via force-reprocess
- [x] `processBlog()` in `src/services/summarisation.ts` — `force` flag added to bypass done guard

## Fix Applied
Three changes made:

1. **`src/services/summarisation.ts`** — Strip markdown code fences before `JSON.parse` in both `generateSummary` and `extractKeywords`. Claude wraps JSON in ` ```json ``` ` blocks; parsing failed silently and returned `[]`. Also added `force` parameter to `processBlog()` to allow reprocessing done rows, and preserved existing `audioUrl` on forced reprocess.

2. **`app/api/blogs/[id]/process/route.ts`** — Read `?force=true` query param and pass it to `processBlog()`.

3. **`src/components/BlogSummaryCard.tsx`** — When Keywords tab is empty on a `done` blog, show a "Regenerate keywords" button that calls `POST /api/blogs/:id/process?force=true`. Fixed `onClick={handleProcess}` → `onClick={() => void handleProcess()}` to avoid passing a MouseEvent as the boolean `force` parameter.
