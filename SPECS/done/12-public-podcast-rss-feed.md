---
feature  : Public Podcast RSS Feed
status   : DONE
created  : 2026-04-11
completed: 2026-04-11
replaces : none
---

# Feature 12 — Public Podcast RSS Feed

## Goal
Expose all completed interview-mode podcast episodes as a standards-compliant RSS 2.0 feed (with iTunes namespace) so the podcast can be submitted to Apple Podcasts, Spotify, and other directories — at zero additional cost, using only existing infrastructure.

---

## User Stories

- As a listener, I want to subscribe to the podcast in my preferred podcast app so I get new episodes automatically.
- As the podcast owner, I want to submit the feed to Apple Podcasts and Spotify for free distribution without any third-party hosting service.
- As a visitor, I want to browse published episodes on a public page and play them without signing in.

---

## Feed Generation Flow

```
1. Podcast app or directory fetches GET /api/podcast/rss.xml
2. Route is public — no authentication required
3. Server queries blog_summaries JOIN blogs WHERE interviewAudioStatus = 'done'
   ORDER BY processedAt DESC
4. Builds RSS 2.0 XML string with <channel> metadata and one <item> per episode
5. Returns response with Content-Type: application/rss+xml; charset=utf-8
6. Podcast app parses feed, downloads MP3s from Vercel Blob URLs
```

---

## Data Model

No new tables or schema changes. Reads from existing:

- `blog_summaries` — `interviewAudioUrl`, `interviewAudioStatus`, `interviewScript`, `processedAt`
- `blogs` — `title`, `url`, `source`, `author`, `estimatedReadMin`

---

## API Routes

| Method | Route | Description |
|---|---|---|
| GET | `/api/podcast/rss.xml` | Public RSS 2.0 feed with iTunes namespace — no auth |
| GET | `/podcast` | Public episode listing page (optional, no auth) |

---

## Service Layer

### `src/models/podcast.ts` (new)

- **`getPublishedEpisodes()`** — Joins `blog_summaries` + `blogs`, filters `interviewAudioStatus = 'done'`, orders by `processedAt DESC`. Returns a typed list of episode rows.

### `app/api/podcast/rss.xml/route.ts` (new)

- No auth guard — publicly accessible
- Reads channel metadata from env vars (with sensible defaults)
- Calls `getPublishedEpisodes()`
- Builds RSS XML string using a typed template function — no XML library needed
- Sets `Cache-Control: public, max-age=3600` (1h cache — reduces DB load from polling apps)
- Returns `new Response(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } })`

### RSS XML Structure

```xml
<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"
  xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>{{PODCAST_TITLE}}</title>
    <link>{{NEXT_PUBLIC_APP_URL}}</link>
    <description>{{PODCAST_DESCRIPTION}}</description>
    <language>en-us</language>
    <itunes:author>{{PODCAST_AUTHOR}}</itunes:author>
    <itunes:image href="{{PODCAST_IMAGE_URL}}"/>
    <itunes:category text="Technology"/>
    <itunes:explicit>false</itunes:explicit>

    <!-- One per episode -->
    <item>
      <title>{{blog.title}}</title>
      <guid isPermaLink="false">{{blogSummary.blogId}}</guid>
      <pubDate>{{processedAt in RFC 2822}}</pubDate>
      <description>{{first 300 chars of interviewScript}}</description>
      <enclosure url="{{interviewAudioUrl}}" length="0" type="audio/mpeg"/>
      <itunes:duration>{{estimatedReadMin * 60}}</itunes:duration>
      <itunes:author>{{blog.author ?? PODCAST_AUTHOR}}</itunes:author>
    </item>
  </channel>
</rss>
```

> `enclosure length="0"` is acceptable — Apple Podcasts and Spotify validate the URL, not the byte count. Computing exact file size would require a Vercel Blob HEAD request per episode (slow, expensive).

### `app/podcast/page.tsx` (new — public, no auth)

- Server component — fetches `getPublishedEpisodes()` server-side
- Lists episodes: title, source, estimated duration
- Each episode has a native `<audio>` player pointing at `interviewAudioUrl`
- Link to subscribe (`/api/podcast/rss.xml`) with copy-to-clipboard button
- Accessible without login — no `auth()` check

### Required Env Vars

```env
PODCAST_TITLE=Stickler Interviews
PODCAST_DESCRIPTION=AI-powered two-voice interviews with authors of the best tech articles.
PODCAST_AUTHOR=Stickler
PODCAST_IMAGE_URL=https://... (1400x1400px, hosted on Vercel Blob or any CDN)
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
```

---

## Edge Cases

| Case | Handling |
|---|---|
| No episodes yet | Feed returns valid XML with empty `<channel>` (no `<item>` elements); podcast apps handle this gracefully |
| `PODCAST_IMAGE_URL` not set | Omit `<itunes:image>` — feed is still valid; Apple shows a default icon |
| `NEXT_PUBLIC_APP_URL` not set | Fall back to `http://localhost:3000` in dev; log a warning in prod |
| Episode `processedAt` is null | Use current timestamp as fallback `pubDate` |
| Interview script is null | Use blog title + source as `<description>` fallback |
| Vercel Blob URL changes/expires | Public Blob URLs are permanent — no expiry concern |
| Podcast app polls aggressively | `Cache-Control: public, max-age=3600` reduces DB load; no rate-limiting needed |
| Special characters in title/description | Wrap in `<![CDATA[...]]>` blocks to avoid XML escaping issues |

---

## Directory Submission Steps (post-deploy)

1. Deploy to production — confirm `https://yourdomain.com/api/podcast/rss.xml` returns valid XML
2. Upload a 1400×1400px cover image to Vercel Blob, set `PODCAST_IMAGE_URL`
3. **Apple Podcasts**: submit at [podcasters.apple.com](https://podcasters.apple.com) → "Add a show by RSS feed"
4. **Spotify**: submit at [podcasters.spotify.com](https://podcasters.spotify.com) → "Import existing podcast"
5. Both validate the feed and start indexing within 24–72h

---

## Acceptance Criteria

- [ ] `GET /api/podcast/rss.xml` returns `Content-Type: application/rss+xml`
- [ ] Feed is publicly accessible without authentication
- [ ] Feed validates in [podba.se](https://podba.se) or [castfeedvalidator.com](https://castfeedvalidator.com)
- [ ] One `<item>` per episode with `interviewAudioStatus = 'done'`, ordered newest first
- [ ] `<enclosure>` URL points to a reachable Vercel Blob MP3
- [ ] `<guid>` is stable and unique per episode (uses `blogId`)
- [ ] `Cache-Control: public, max-age=3600` header is set
- [ ] `CDATA` wrapping prevents XML parse errors from special characters
- [ ] `/podcast` public page lists all episodes with native audio player
- [ ] `/podcast` is accessible without login
- [ ] Feed can be submitted to Apple Podcasts and Spotify without errors
