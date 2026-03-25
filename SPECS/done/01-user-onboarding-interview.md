---
feature  : User Onboarding Interview
status   : DONE
created  : 2026-03-21
completed: 2026-03-21
replaces : none
---

# Feature 1 — User Onboarding Interview (Agentic Interest Profiling)

## Goal
Guide a new user through a conversational interview to capture their interest areas, professional role, learning aspirations, and motivation. If the user is vague or unsure, the agent must probe further before moving on. The output is a structured **Learning Profile** stored in the database.

---

## User Stories

- As a new user, I want to be asked questions about what I want to learn so the app can personalise my blog feed.
- As a user who isn't sure what to learn, I want the app to help me discover my interests through guided questions.
- As a returning user, I want to update my learning profile without going through the full interview again.

---

## Agentic Interview Flow

```
1. Greet user, explain purpose (1-2 sentences max)
2. Ask: What is your current role / profession?
3. Ask: What topics or domains interest you? (broad)
4. Depth probe: For each stated interest → "What specifically about X interests you?"
5. Ask: What is your current knowledge level in each area? (beginner / intermediate / advanced)
6. Ask: What do you want to achieve? (career growth / curiosity / stay current / skill building)
7. If answers are vague → enter clarification loop (max 3 follow-ups per topic)
8. Summarise profile back to user for confirmation
9. Allow user to edit or confirm
10. Save Learning Profile to DB
```

### Clarification Loop (if user is unclear)
- Trigger: answer is < 10 words OR contains phrases like "not sure", "anything", "everything"
- Response: offer 3 specific examples or domains to choose from
- Max depth: 3 follow-ups per question before moving on with best-guess + flag for later

---

## Data Model

### `users` table
```sql
id            UUID PRIMARY KEY
email         TEXT UNIQUE NOT NULL
created_at    TIMESTAMPTZ DEFAULT now()
```

### `learning_profiles` table
```sql
id              UUID PRIMARY KEY
user_id         UUID REFERENCES users(id)
role            TEXT
interests       JSONB   -- [{ topic: string, depth: string, keywords: string[] }]
aspirations     JSONB   -- [{ goal: string, priority: number }]
knowledge_level JSONB   -- { topic: string, level: 'beginner'|'intermediate'|'advanced' }[]
motivation      TEXT
is_confirmed    BOOLEAN DEFAULT false
created_at      TIMESTAMPTZ DEFAULT now()
updated_at      TIMESTAMPTZ DEFAULT now()
```

---

## API Routes

| Method | Route | Description |
|---|---|---|
| POST | `/api/onboarding/start` | Start a new interview session |
| POST | `/api/onboarding/respond` | Submit user answer, get next question |
| POST | `/api/onboarding/confirm` | Confirm and save learning profile |
| GET  | `/api/onboarding/profile` | Fetch current user's learning profile |
| PATCH | `/api/onboarding/profile` | Update specific fields of the profile |

---

## Service Layer

### `OnboardingAgentService` (`src/services/onboarding-agent.ts`)
- `startSession(userId)` → initialise conversation state
- `processResponse(sessionId, userMessage)` → call Claude API, return next question
- `isProfileComplete(sessionState)` → validate all required fields are present
- `saveProfile(userId, sessionState)` → persist to `learning_profiles` table

### Conversation State (in-memory / Redis session)
```ts
{
  sessionId: string
  userId: string
  step: number
  answers: Record<string, string>
  clarificationCount: Record<string, number>
  isComplete: boolean
}
```

---

## Claude API Prompt Design

**System prompt:**
```
You are an expert learning coach interviewing a user to understand their professional role,
interests, and learning goals. Ask one focused question at a time. If the user is vague,
offer 3 concrete examples to help them choose. Never ask more than 3 follow-ups on the
same topic. When you have enough information, summarise the profile and ask for confirmation.
Output structured JSON after confirmation: { role, interests, aspirations, motivation }.
```

---

## UI Components

- `OnboardingChat` — chat-style interview UI (full screen on first login)
- `ProfileSummaryCard` — displays captured profile for user confirmation
- `ProfileEditForm` — allows editing individual fields post-confirmation

---

## Edge Cases

| Case | Handling |
|---|---|
| User abandons mid-interview | Save partial state; resume on next login |
| User submits empty answers | Re-prompt once, then skip with default value + flag |
| User wants to restart | Clear session state, restart from step 1 |
| Returning user wants to update | PATCH endpoint — no full re-interview needed |
| Claude API timeout | Retry once; if fails, show error and offer manual form fallback |

---

## Security & Validation

- All inputs validated with Zod before reaching service layer
- Sanitise all free-text fields (XSS prevention)
- Rate-limit `/api/onboarding/respond` — max 60 requests/min per user
- Session state tied to authenticated user ID (Clerk)

---

## Acceptance Criteria

- [ ] New user is greeted and guided through all interview steps
- [ ] Vague answers trigger clarification loop (max 3 follow-ups)
- [ ] Add industry standard guardrails for user input and resposne filtering
- [ ] Profile summary shown to user before saving
- [ ] Confirmed profile saved to `learning_profiles` table
- [ ] Returning user can update profile without full re-interview
- [ ] Claude API failure falls back gracefully to manual form
- [ ] All routes are auth-gated (Clerk middleware)
- [ ] Zod validation on all inputs
- [ ] Unit tests: `OnboardingAgentService` (happy path + vague answer + API failure)
- [ ] E2E test: full onboarding flow via Playwright
