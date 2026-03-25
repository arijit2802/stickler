---
feature  : Blog Q&A and Feedback Loop
status   : ACTIVE
created  : 2026-03-21
completed: —
replaces : none
---

# Feature 4 — Blog Q&A and Feedback Loop

## Goal
After a user reads (or listens to) a blog, present a short Q&A to reinforce learning and collect feedback on both the blog content and the recommendation quality. Results feed back into the user's Learning Profile to improve future recommendations.

---

## User Stories

- As a user, I want a short quiz after reading a blog to check my understanding.
- As a user, I want to give feedback on whether the blog matched my interests.
- As the system, I want feedback signals to improve future blog recommendations.

---

## Q&A Flow

```
1. Trigger: user marks blog as "read" in reading calendar
2. Generate 3 comprehension questions via Claude (based on blog content)
   - 2 factual recall questions
   - 1 application / opinion question
3. User answers questions (free text or MCQ)
4. Claude evaluates answers → score + brief explanation
5. Show user their score and learning reinforcement notes
6. Ask feedback questions:
   a. Was this blog relevant to your interests? (1–5 stars)
   b. Was the difficulty level right? (too easy / just right / too hard)
   c. Optional: free-text comment
7. Save all signals to DB
8. Update recommendation weight for this topic/source
```

---

## Data Model

### `blog_quizzes` table
```sql
id              UUID PRIMARY KEY
blog_id         UUID REFERENCES blogs(id)
questions       JSONB   -- [{ question, type: 'recall'|'application', options?: string[] }]
generated_at    TIMESTAMPTZ DEFAULT now()
```

### `quiz_attempts` table
```sql
id              UUID PRIMARY KEY
user_id         UUID REFERENCES users(id)
quiz_id         UUID REFERENCES blog_quizzes(id)
answers         JSONB   -- [{ question_id, answer: string }]
score           INT     -- 0-100
feedback        JSONB   -- { rating: 1-5, difficulty: string, comment?: string }
completed_at    TIMESTAMPTZ DEFAULT now()
```

### `recommendation_signals` table
```sql
id              UUID PRIMARY KEY
user_id         UUID REFERENCES users(id)
blog_id         UUID REFERENCES blogs(id)
relevance_score INT     -- 1-5 (from user feedback)
difficulty      TEXT
source          TEXT    -- blog source domain
topic           TEXT    -- matched interest topic
created_at      TIMESTAMPTZ DEFAULT now()
```

---

## API Routes

| Method | Route | Description |
|---|---|---|
| GET  | `/api/blogs/:id/quiz` | Get or generate quiz for a blog |
| POST | `/api/blogs/:id/quiz/submit` | Submit answers, get score |
| POST | `/api/blogs/:id/feedback` | Submit blog feedback |
| GET  | `/api/users/me/quiz-history` | User's quiz history and scores |

---

## Service Layer

### `QuizService` (`src/services/quiz.ts`)
- `generateQuiz(blogId)` → call Claude with blog content, return 3 questions
- `evaluateAnswers(quizId, answers)` → call Claude to score free-text answers
- `saveAttempt(userId, quizId, answers, score)` → persist to DB

### `FeedbackService` (`src/services/feedback.ts`)
- `saveFeedback(userId, blogId, feedback)` → persist to `quiz_attempts`
- `updateRecommendationSignals(userId, blogId, signals)` → upsert into `recommendation_signals`

---

## Claude API Prompts

**Quiz generation:**
```
Based on this blog article, generate exactly 3 questions to test comprehension.
- Question 1: factual recall (what/who/when)
- Question 2: conceptual understanding (why/how)
- Question 3: application or opinion (what would you do / what do you think)
Return JSON: [{ question, type, hint? }]
```

**Answer evaluation:**
```
The user answered these quiz questions about the article. Score each answer 0-100 and provide
a 1-sentence explanation. Be encouraging but accurate.
Return JSON: [{ question, user_answer, score, explanation }]
```

---

## Edge Cases

| Case | Handling |
|---|---|
| User skips quiz | Still allow feedback; quiz marked as skipped |
| Claude generates duplicate questions | Deduplicate by semantic similarity; regenerate if needed |
| User gives very short/poor answers | Score low with constructive feedback, don't penalise harshly |
| Blog has no meaningful content to quiz | Generate 1 opinion question only; skip factual questions |

---

## Acceptance Criteria

- [ ] Quiz generated automatically when blog is marked as read
- [ ] User can answer and submit quiz, receives score + explanations
- [ ] Feedback (rating + difficulty) collected after quiz
- [ ] Signals saved to `recommendation_signals` table
- [ ] Quiz skippable without blocking the feedback form
- [ ] Unit tests: `QuizService` (generation, evaluation, edge cases)
- [ ] E2E: read blog → quiz → feedback → signal stored
