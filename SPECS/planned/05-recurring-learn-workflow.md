---
feature  : Recurring Learn Workflow (Every 3 Days)
status   : ACTIVE
created  : 2026-03-21
completed: —
replaces : none
---

# Feature 5 — Recurring Learn Workflow

## Goal
Every 3 days, the system automatically re-runs the blog discovery workflow, incorporating feedback signals and reading history to evolve the user's topic focus — deepening known interests or broadening into adjacent areas.

---

## User Stories

- As a user, I want new blogs suggested automatically every 3 days without manual intervention.
- As a user, I want the recommendations to improve over time based on what I've read and rated.
- As a user, I want to be notified when my next batch of blogs is ready.

---

## Workflow Steps

```
1. Scheduled trigger: every 3 days per user (based on onboarding date)
2. Load user's Learning Profile + recommendation signals from last cycle
3. Call Claude to analyse signals:
   - Topics with high ratings → go deeper (more specific subtopics)
   - Topics rated low → reduce weight or swap out
   - Topics not yet explored → introduce 1 new adjacent topic
4. Generate updated search queries (same flow as Feature 2)
5. Run Tavily Search, rank, deduplicate
6. Add next 3 blogs to reading calendar (days +1, +2, +3)
7. Send user notification (in-app + optional email)
8. Log workflow run to audit table
```

### Topic Evolution Strategy
```
High feedback (4-5★) on topic X →
  next cycle: search for subtopics of X or advanced material

Low feedback (1-2★) on topic X after 2 cycles →
  reduce weight of X; introduce adjacent topic from profile

No feedback on topic X (skipped blogs) →
  try once more with different source/framing; then deprioritise
```

---

## Data Model

### `workflow_runs` table
```sql
id              UUID PRIMARY KEY
user_id         UUID REFERENCES users(id)
run_at          TIMESTAMPTZ DEFAULT now()
blogs_added     UUID[]      -- blog IDs added this run
topic_updates   JSONB       -- { topic, action: 'deepened'|'broadened'|'deprioritised' }[]
status          TEXT        -- 'completed' | 'failed' | 'partial'
error           TEXT
```

---

## API Routes

| Method | Route | Description |
|---|---|---|
| POST | `/api/workflow/trigger` | Manually trigger workflow (debug/admin) |
| GET  | `/api/workflow/history` | Get workflow run history for user |
| GET  | `/api/workflow/next-run` | Get timestamp of next scheduled run |

---

## Service Layer

### `LearnWorkflowService` (`src/services/learn-workflow.ts`)
- `runForUser(userId)` → orchestrates full workflow
- `analyseSignals(userId)` → load signals, call Claude for topic strategy
- `evolveTopics(profile, signals)` → return updated topic weights
- `scheduleNextRun(userId)` → set next trigger in job queue

### Scheduling
- Use a job queue (e.g. BullMQ with Redis) for per-user scheduled jobs
- Cron: every hour, check `workflow_runs` for users due a run
- Avoid running if user has unconfirmed suggestions from previous cycle

---

## Edge Cases

| Case | Handling |
|---|---|
| User hasn't read any blogs in 3 days | Still run; use profile defaults, no signal adjustment |
| All available blogs already seen | Widen search to secondary interest topics |
| Workflow fails mid-run | Log partial state; retry next scheduled hour |
| User pauses their account | Skip workflow; resume when user re-activates |
| New user (< 3 days old) | Don't run; Feature 2 handled initial suggestions |

---

## Acceptance Criteria

- [ ] Workflow runs automatically every 3 days per user
- [ ] Topic strategy updated based on feedback signals
- [ ] 3 new blogs added to calendar per run
- [ ] In-app notification sent on completion
- [ ] Workflow run logged to `workflow_runs` table
- [ ] Failed runs retried without duplicate blog entries
- [ ] Unit tests: `LearnWorkflowService` (signal analysis, topic evolution, scheduling)
- [ ] Integration test: simulate 3 workflow cycles and verify topic drift
