---
feature  : Blog Summarisation, Keywords & Learning Shorts
status   : DONE
created  : 2026-03-21
completed: 2026-04-02
replaces : none
---

# Feature 3 — Blog Summarisation, Keywords & Learning Shorts

## Goal
For each confirmed blog in the reading calendar, automatically generate:
1. A structured summary
2. Key concepts with short definitions
3. A "Learning Short" — a 5–10 minute audio-ready script (listenable while commuting)

---

## User Stories

- As a user, I want a concise summary of each blog so I can decide if I want to read the full article.
- As a user, I want key terms explained briefly so I can build vocabulary in the topic area.
- As a user, I want short audio content I can listen to while driving or commuting.

---

## Processing Flow

```
1. Trigger: blog added to reading_calendar (event-driven)
2. Fetch full blog content (scrape URL or use Tavily extract)
3. Send to Claude API:
   a. Generate structured summary (3–5 bullet points)
   b. Extract 5–7 keywords with 1-sentence definitions
   c. Write a 5–10 min "Learning Short" script (conversational tone)
4. Store outputs in DB
5. Convert Learning Short script to audio via TTS (e.g. ElevenLabs or browser TTS)
6. Store audio file URL
7. Mark blog as "processed"
```

---

## Data Model

### `blog_summaries` table
```sql
id              UUID PRIMARY KEY
blog_id         UUID REFERENCES blogs(id)
summary_bullets JSONB   -- string[]
keywords        JSONB   -- [{ term: string, definition: string }]
learning_short  TEXT    -- script text
audio_url       TEXT    -- URL to stored audio file
processed_at    TIMESTAMPTZ DEFAULT now()
```

---

## API Routes

| Method | Route | Description |
|---|---|---|
| GET  | `/api/blogs/:id/summary` | Get summary, keywords, learning short for a blog |
| POST | `/api/blogs/:id/process` | Manually trigger processing (admin/debug) |
| GET  | `/api/blogs/:id/audio` | Stream or return audio URL |

---

## Service Layer

### `SummarisationService` (`src/services/summarisation.ts`)
- `processBlog(blogId)` → orchestrates all 3 outputs via Claude
- `generateSummary(content)` → returns bullet points
- `extractKeywords(content)` → returns term + definition pairs
- `writeLearningShort(content, keywords)` → returns conversational script

### `AudioService` (`src/services/audio.ts`)
- `generateAudio(script, blogId)` → call TTS API, return audio URL
- `getAudioUrl(blogId)` → fetch from DB

---

## Claude API Prompts

**Summary prompt:**
```
Summarise this blog post in 3-5 bullet points. Each bullet should be one clear, actionable insight. Avoid filler phrases.
```

**Keywords prompt:**
```
Extract 5-7 key technical or domain-specific terms from this article. For each, write a 1-sentence plain-English definition that a beginner would understand.
```

**Learning Short prompt:**
```
Write a 2-3 minute spoken script based on this article. Style: conversational, like a smart friend explaining it. Include: the main idea, why it matters, and one practical takeaway. No bullet points — flowing prose only.
```

---

## Edge Cases

| Case | Handling |
|---|---|
| Blog content can't be scraped | Mark as `unprocessable`, notify user, skip audio |
| Article is very short (< 300 words) | Still process; shorter summary is fine |
| TTS API fails | Store script only; surface text version to user; retry audio async |
| Article in non-English | Detect language; process in original language + flag for user |
| Claude returns malformed JSON | Retry once with stricter prompt; fallback to raw text |

---

## Acceptance Criteria

- [ ] Summary, keywords, and learning short generated for every confirmed blog
- [ ] Audio file generated and stored; accessible via `/api/blogs/:id/audio`
- [ ] User can read summary and keywords in reading view
- [ ] User can play audio from blog card
- [ ] TTS failure degrades gracefully (text script still available)
- [ ] Unit tests: `SummarisationService` (all 3 outputs + fallbacks)
- [ ] Integration test: end-to-end blog → summary → audio pipeline
