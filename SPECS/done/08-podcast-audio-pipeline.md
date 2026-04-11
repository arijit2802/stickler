---
feature  : Podcast Audio Pipeline
status   : DONE
created  : 2026-04-05
completed: 2026-04-08
replaces : none
---

# Feature 8 — Podcast Audio Pipeline

## Goal
Replace the browser `speechSynthesis` stub with a real server-side audio pipeline: rewrite the Learning Short as spoken narration, generate an MP3 via OpenAI TTS, store it on Vercel Blob, and surface a podcast-style player in the UI. Users should be able to listen to any blog's learning short as if it were a podcast episode — including on mobile.

---

## User Stories

- As a user, I want to listen to a blog's learning short in a high-quality voice that sounds consistent across all devices.
- As a user, I want to control playback speed and rewind 15 seconds, like a real podcast app.
- As a user on mobile, I want audio to work the same way it does on desktop.
- As the system, I want audio to be generated once and cached so I'm not calling TTS on every request.

---

## Processing Flow

```
1. Blog confirmed → processBlog() runs (existing)
2. writePodcastScript() generates spoken-word narration via Claude
   (replaces writeLearningShort() — different prompt, same pipeline position)
3. generateAudio(script, blogId) calls OpenAI TTS API
   → model: tts-1-hd, voice: onyx (deep, clear)
   → returns MP3 binary stream
4. Upload MP3 to Vercel Blob → get public URL
5. Store URL in blog_summaries.audio_url (column already exists)
6. BlogSummaryCard detects audio_url → renders podcast player
   (falls back to "Generating audio…" spinner if audio_url still null)
```

---

## Podcast Script vs Learning Short

The existing `writeLearningShort()` prompt produces text that works for reading but sounds unnatural when spoken. The new `writePodcastScript()` prompt must produce audio-first content:

**Rules for the new Claude prompt:**
- No bullet points, no markdown, no headers
- Flowing prose, 350–450 words (≈ 2.5–3 min at 150 wpm)
- Open with a hook ("Here's something worth knowing about…"), not "In this blog…"
- Include one concrete example or analogy
- Close with a single actionable takeaway
- Write for the ear, not the eye — short sentences, avoid jargon without explanation

**Prompt:**
```
Write a 2.5–3 minute spoken podcast script based on this article.
Rules:
- Flowing prose only — no bullet points, no headers, no markdown
- Open with a hook that makes the listener want to keep listening
- Use natural speech patterns: short sentences, occasional rhetorical questions
- Include one concrete analogy or real-world example
- Close with a single actionable takeaway the listener can apply today
- Target length: 350–450 words
Article content: {content}
```

---

## Data Model

No new tables. Uses existing `blog_summaries` columns:

```sql
learning_short   TEXT    -- now stores the podcast script (spoken-word prose)
audio_url        TEXT    -- populated by generateAudio(); was null in Feature 3 stub
```

One new column needed on `blog_summaries`:

```sql
audio_status     TEXT DEFAULT 'none'   -- none | generating | done | failed
```

This prevents duplicate concurrent audio generation and lets the UI show the correct state.

---

## API Routes

| Method | Route | Description |
|---|---|---|
| GET | `/api/blogs/:id/audio` | Returns `{ audioUrl, audioStatus, script }` — already exists, update response shape |
| POST | `/api/blogs/:id/audio/generate` | Manually trigger audio generation (for retry on failure) |

The existing `GET /api/blogs/:id/audio` is updated — no breaking change, just adds `audioStatus` to the response.

---

## Service Layer

### `src/services/audio.ts` (replace stub)
- `generateAudio(script, blogId)` — call OpenAI TTS, upload to Vercel Blob, persist URL
- `getAudioUrl(blogId)` — fetch `audio_url` + `audio_status` from DB (unchanged signature)

### `src/services/summarisation.ts` (small change)
- Rename `writeLearningShort()` → `writePodcastScript()` with new prompt
- `processBlog()` call updated accordingly
- Old `learning_short` column still used — just populated with better content

### `src/models/summarisation.ts` (small change)
- Add `audioStatus` field to DB reads/writes
- `saveAudioUrl()` also sets `audioStatus = 'done'`
- New `setAudioStatus(blogId, status)` helper

---

## New UI: Podcast Player

Replaces the `▶ Listen (browser TTS)` button in `BlogSummaryCard`'s Learning Short tab.

**Player controls:**
- Play / Pause button
- Progress bar (scrubable — use `<input type="range">` synced to `audio.currentTime`)
- Current time / total duration display (e.g. `1:23 / 3:05`)
- Playback speed selector: `0.75×  1×  1.25×  1.5×` (set `audio.playbackRate`)
- −15s rewind button

**States:**
| `audio_url` | `audio_status` | UI shown |
|---|---|---|
| null | `none` / `generating` | "Generating audio…" spinner |
| null | `failed` | "Audio unavailable" + retry button |
| set | `done` | Full player |

**Implementation:** Native `<audio>` element with `ref` — no third-party audio library needed.

---

## Environment Variables

```
OPENAI_API_KEY          # for TTS calls (tts-1-hd)
BLOB_READ_WRITE_TOKEN   # for Vercel Blob uploads
```

---

## Packages

- `openai` — OpenAI Node SDK (for TTS; confirm before installing)
- `@vercel/blob` — Vercel Blob SDK (confirm before installing)

---

## Edge Cases

| Case | Handling |
|---|---|
| OpenAI TTS call fails | Set `audio_status = 'failed'`; script text still available; show retry button |
| Blob upload succeeds but DB write fails | Re-upload is idempotent (same filename key); retry safe |
| Audio already generating (concurrent trigger) | Guard on `audio_status = 'generating'`; return 409 from API |
| User on mobile | `<audio>` element is natively supported on iOS/Android; no fallback needed |
| Blog has very short content (< 100 words) | Generate a shorter script (1 min); do not skip — short is fine |
| Existing `learning_short` rows (Feature 3 data) | Retroactively regenerate on first play request via `POST /api/blogs/:id/audio/generate` |

---

## Acceptance Criteria

- [ ] `writePodcastScript()` produces flowing spoken-word prose (no bullets/markdown)
- [ ] OpenAI TTS (`tts-1-hd`, voice `onyx`) called with the script; MP3 returned
- [ ] MP3 uploaded to Vercel Blob; public URL stored in `blog_summaries.audio_url`
- [ ] `GET /api/blogs/:id/audio` returns `audioUrl`, `audioStatus`, and `script`
- [ ] Podcast player renders with play/pause, scrub bar, speed selector, −15s rewind
- [ ] Player shows correct state for each `audio_status` value
- [ ] Audio plays correctly on iOS Safari and Android Chrome (test on real device)
- [ ] `audio_status` guard prevents duplicate concurrent generation
- [ ] Retry button works when `audio_status = 'failed'`
- [ ] `browser speechSynthesis` code fully removed from `BlogSummaryCard`
- [ ] No new DB migration for `audio_url` (already exists); migration only for `audio_status`
