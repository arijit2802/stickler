---
feature  : Blog Q&A and Feedback Loop
status   : PLANNED
created  : 2026-03-21
completed: —
replaces : none
---

# Feature 4 — Blog Q&A and Feedback Loop

## Goal
After a user reads or listens to a blog, present 3 auto-generated comprehension questions to reinforce learning. Claude grades answers and explains them. Users also give a relevance rating and difficulty rating. All signals are persisted and feed directly into Feature 6 (Monthly Knowledge Assessment).

---

## User Stories

- As a user, I want a short quiz after reading or listening to a blog to check my understanding.
- As a user, I want feedback on my answers — not just a score, but a brief explanation of what I got right or wrong.
- As a user, I want to rate whether the blog was relevant to my interests so future recommendations improve.
- As the system, I want quiz scores and feedback signals persisted so Feature 6 can assess knowledge over time.

---

## Trigger Conditions

Q&A is triggered by either of:
- User marks a blog as **"read"** in the reading calendar or home dashboard
- User finishes listening to the podcast audio (audio `ended` event fires, ≥ 80% progress)

Both triggers use the same Q&A flow. The `trigger_source` (`read` | `listened`) is stored with the attempt for analytics.

---

## Q&A Flow

```
1. Trigger: user marks blog as "read" OR audio playback reaches ≥ 80%
2. Check if quiz already exists for this blog_id (one quiz per blog, shared across users)
   a. Exists → use cached quiz
   b. Not exists → generate via Claude (see prompt below)
3. Present 3 questions to user:
   - Q1: factual recall (what/who/when)
   - Q2: conceptual understanding (why/how)
   - Q3: application or opinion (what would you do / what do you think)
4. User answers all 3 (free text; no MCQ for MVP — reduces prompt complexity)
5. Claude evaluates answers → per-question score (0–100) + 1-sentence explanation
6. Show user their scores and explanations
7. Collect feedback:
   a. Was this blog relevant to your interests? (1–5 stars)
   b. Was the difficulty level right? (too easy / just right / too hard)
   c. Optional free-text comment
8. Save quiz attempt + feedback to DB
9. Write to recommendation_signals (feeds Feature 2 dedup logic and Feature 6)
```

---

## Context Used for Question Generation

**Do NOT pass raw blog content to Claude** — it's too long and adds unnecessary tokens.

Use the already-generated Feature 3 outputs:
- `blog_summaries.summary_bullets` — for factual/conceptual questions
- `blog_summaries.learning_short` — for application/opinion question
- `blogs.title` + `blogs.source` — for context framing

If `blog_summaries` row doesn't exist yet (processing still running), poll once after 5 seconds then show "Quiz not ready yet — check back after reading."

---

## Data Model

### `blog_quizzes` table
```sql
id              UUID PRIMARY KEY
blog_id         UUID REFERENCES blogs(id) UNIQUE  -- one quiz per blog
questions       JSONB   -- [{ id: uuid, question: string, type: 'recall'|'conceptual'|'application' }]
generated_at    TIMESTAMPTZ DEFAULT now()
```

### `quiz_attempts` table
```sql
id              UUID PRIMARY KEY
user_id         UUID REFERENCES users(id)
quiz_id         UUID REFERENCES blog_quizzes(id)
trigger_source  TEXT    -- 'read' | 'listened'
answers         JSONB   -- [{ question_id: uuid, answer: string }]
scores          JSONB   -- [{ question_id: uuid, score: int, explanation: string }]
total_score     INT     -- average of per-question scores (0–100)
feedback        JSONB   -- { rating: 1-5, difficulty: 'easy'|'right'|'hard', comment?: string }
completed_at    TIMESTAMPTZ DEFAULT now()
```

### `recommendation_signals` table
```sql
id              UUID PRIMARY KEY
user_id         UUID REFERENCES users(id)
blog_id         UUID REFERENCES blogs(id)
relevance_score INT     -- 1-5 (from user star rating)
difficulty      TEXT    -- 'easy' | 'right' | 'hard'
quiz_score      INT     -- total_score from quiz_attempts (null if quiz skipped)
source          TEXT    -- blog source domain
topic           TEXT    -- matched interest topic from learning_profile
created_at      TIMESTAMPTZ DEFAULT now()
```

---

## API Routes

| Method | Route | Description |
|---|---|---|
| GET  | `/api/blogs/:id/quiz` | Get or generate quiz for a blog; returns questions |
| POST | `/api/blogs/:id/quiz/submit` | Submit answers; returns scores + explanations |
| POST | `/api/blogs/:id/feedback` | Submit relevance + difficulty feedback |
| GET  | `/api/users/me/quiz-history` | User's quiz history, scores, and topic breakdown |

---

## Service Layer

### `src/services/quiz.ts`
- `getOrGenerateQuiz(blogId)` — check DB first; if missing, call Claude with summary context
- `evaluateAnswers(quizId, answers)` — call Claude with questions + answers; return scored results
- `saveAttempt(userId, quizId, answers, scores, triggerSource)` — persist to `quiz_attempts`

### `src/services/feedback.ts`
- `saveFeedback(userId, blogId, feedback)` — write `feedback` field on `quiz_attempts`
- `writeRecommendationSignal(userId, blogId, signal)` — upsert into `recommendation_signals`

---

## Claude API Prompts

**Quiz generation (uses summary context, not full content):**
```
A user just read a blog article. Here is a structured summary of the article:

Title: {title}
Summary bullets:
{summary_bullets}

Generate exactly 3 comprehension questions to reinforce learning.
- Question 1 (type: recall): a factual question answerable from the summary
- Question 2 (type: conceptual): a "why" or "how" question testing understanding
- Question 3 (type: application): an opinion or "what would you do" question with no single right answer

Return JSON: [{ "id": "uuid", "question": "...", "type": "recall|conceptual|application" }]
```

**Answer evaluation:**
```
The user answered 3 questions about a blog article. Score each answer 0–100 and provide a 1-sentence explanation. Be encouraging but honest. For application/opinion questions, give full marks for any thoughtful answer.

Questions and answers: {qa_pairs}

Return JSON: [{ "question_id": "uuid", "score": 0-100, "explanation": "..." }]
```

---

## UI Flow

```
Reading calendar / home dashboard
  → User clicks "Mark as Read" or audio ends
  → Modal / slide-up panel appears with quiz
  → Answer 3 questions (text inputs)
  → Submit → show scores + explanations
  → Below scores: feedback form (stars + difficulty selector)
  → Submit feedback → dismiss panel
  → Quiz score shown as badge on blog card (e.g. "8/10")
```

Quiz is skippable at any point — show "Skip quiz" link that goes directly to feedback form. Feedback is also skippable.

---

## Edge Cases

| Case | Handling |
|---|---|
| Blog summary not ready when trigger fires | Show "Quiz not ready yet" message; do not generate quiz without summary context |
| User triggers Q&A twice for same blog | Show previous attempt results; offer "Retake quiz" — new attempt saved, old preserved |
| Claude returns malformed JSON for questions | Retry once with stricter prompt; if still fails, skip quiz and go directly to feedback |
| Application/opinion answers graded too harshly | Prompt instructs full marks for any thoughtful answer (> 20 words); implemented in eval prompt |
| User skips both quiz and feedback | No signal written; that's fine for MVP |
| `trigger_source = 'listened'` | Audio `ended` event fires → same modal flow; `trigger_source` stored as `'listened'` |

---

## Acceptance Criteria

- [ ] Quiz generated automatically when blog is marked "read" (uses summary bullets, not raw content)
- [ ] Quiz generated automatically when podcast audio reaches ≥ 80% completion
- [ ] One quiz per blog cached in DB — not regenerated for every user
- [ ] User can answer and submit quiz; receives per-question score + explanation
- [ ] Application/opinion question always receives ≥ 60 score for any substantive answer
- [ ] Relevance rating (1–5 stars) + difficulty selection collected after quiz
- [ ] Signals written to `recommendation_signals` table on submission
- [ ] Quiz and feedback both individually skippable
- [ ] Quiz score badge shown on blog card after completion
- [ ] `trigger_source` stored correctly (`read` vs `listened`)
- [ ] `quiz-history` API returns scores broken down by topic
- [ ] Scores persisted in a form usable by Feature 6 (Monthly Knowledge Assessment)
