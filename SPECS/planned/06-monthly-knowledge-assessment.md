---
feature  : Monthly Knowledge Assessment & Benchmarking
status   : ACTIVE
created  : 2026-03-21
completed: —
replaces : none
---

# Feature 6 — Monthly Knowledge Assessment & Benchmarking

## Goal
At the end of each month, generate a personalised knowledge assessment based on everything the user has read. Score the user across their topic areas, benchmark against their previous month, and surface a "knowledge breadth/depth map" to show progress over time.

---

## User Stories

- As a user, I want a monthly assessment to test how much I've actually learned.
- As a user, I want to see how my knowledge has grown compared to last month.
- As a user, I want a visual map showing which areas I'm strong in and where I have gaps.

---

## Assessment Flow

```
1. Trigger: end of month (cron job) OR manual "Take Assessment" button
2. Load all blogs read + quiz scores + feedback from the past month
3. Call Claude to generate 10–15 assessment questions:
   - Mix of: recall, application, synthesis across all topics covered
   - Difficulty calibrated to user's self-reported knowledge level
4. User completes assessment (time-limited: 20 min)
5. Claude evaluates answers → topic-by-topic scores
6. Compute:
   - Breadth score: % of stated interest topics with at least 1 question answered correctly
   - Depth score: average score per topic (weighted by number of blogs read)
7. Compare with previous month's scores → delta
8. Generate narrative summary: "You've grown most in [X], made progress in [Y], [Z] needs attention"
9. Save to DB; surface in dashboard
```

---

## Data Model

### `assessments` table
```sql
id                  UUID PRIMARY KEY
user_id             UUID REFERENCES users(id)
month               DATE            -- first day of the month
questions           JSONB           -- [{ id, topic, question, type, difficulty }]
answers             JSONB           -- [{ question_id, answer, score, explanation }]
breadth_score       INT             -- 0-100
depth_score         INT             -- 0-100
topic_scores        JSONB           -- { topic: string, score: number }[]
narrative           TEXT            -- Claude-generated summary
status              TEXT DEFAULT 'pending'  -- pending | in-progress | completed
started_at          TIMESTAMPTZ
completed_at        TIMESTAMPTZ
```

### `assessment_benchmarks` table
```sql
id              UUID PRIMARY KEY
user_id         UUID REFERENCES users(id)
month           DATE
breadth_delta   INT     -- change from previous month
depth_delta     INT
top_growth_topic TEXT
attention_topic TEXT
created_at      TIMESTAMPTZ DEFAULT now()
```

---

## API Routes

| Method | Route | Description |
|---|---|---|
| POST | `/api/assessment/generate` | Generate monthly assessment |
| GET  | `/api/assessment/current` | Get current pending/in-progress assessment |
| POST | `/api/assessment/submit` | Submit answers |
| GET  | `/api/assessment/history` | All past assessments with scores |
| GET  | `/api/assessment/benchmark` | Month-over-month benchmark data |

---

## Service Layer

### `AssessmentService` (`src/services/assessment.ts`)
- `generateAssessment(userId, month)` → load reading history, call Claude, persist questions
- `evaluateAssessment(assessmentId, answers)` → score via Claude, compute breadth/depth
- `computeBenchmark(userId, month)` → compare with prior month, return deltas
- `generateNarrative(scores, benchmark)` → Claude-written summary paragraph

---

## Claude API Prompts

**Question generation:**
```
The user has read the following articles this month: [titles + topics].
Their self-reported knowledge levels are: [profile].
Generate 10-15 assessment questions that:
- Cover all topics they read about
- Mix recall (40%), application (40%), synthesis (20%)
- Are calibrated to their stated knowledge level
Return JSON: [{ topic, question, type, difficulty, correct_answer }]
```

**Narrative generation:**
```
Based on these assessment scores and month-over-month changes, write a 3-4 sentence
encouraging narrative for the user. Highlight their biggest growth area, acknowledge
consistent progress, and gently flag one area to focus on next month.
```

---

## UI Components

- `AssessmentView` — timed quiz interface (shows progress, time remaining)
- `KnowledgeMap` — radar/spider chart showing topic scores (breadth vs depth)
- `BenchmarkCard` — month-over-month delta with sparklines
- `NarrativeSummary` — Claude-generated text summary with topic highlights

---

## Edge Cases

| Case | Handling |
|---|---|
| User read < 3 blogs in the month | Generate shorter assessment (5 questions); flag low activity |
| User abandons assessment mid-way | Save progress; allow resume within 48h |
| No prior month data for benchmark | Show absolute score only; no delta |
| User triggers assessment early | Allowed; covers blogs read so far in the month |
| All quiz scores were skipped | Generate questions from blog content directly |

---

## Acceptance Criteria

- [ ] Assessment generated automatically at end of each month
- [ ] 10–15 questions covering all topics read that month
- [ ] Breadth and depth scores calculated and stored
- [ ] Month-over-month benchmark computed and displayed
- [ ] Claude narrative summary generated per assessment
- [ ] Knowledge map visualisation rendered in dashboard
- [ ] Abandoned assessments resumable within 48h
- [ ] Unit tests: `AssessmentService` (generation, scoring, benchmarking, narrative)
- [ ] E2E: complete assessment flow → view results → benchmark card
