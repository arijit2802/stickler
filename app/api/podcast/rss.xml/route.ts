import { NextResponse } from "next/server";
import { getPublishedEpisodes } from "@/src/models/podcast";
import { logger } from "@/src/utils/logger";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Wrap content in CDATA to safely embed arbitrary text in XML. */
function cdata(str: string): string {
  return `<![CDATA[${str.replace(/\]\]>/g, "]]]]><![CDATA[>")}]]>`;
}

/** Format a Date as RFC 2822 (required by RSS spec). */
function toRfc2822(date: Date | null): string {
  const d = date ?? new Date();
  return d.toUTCString();
}

/** Extract first N characters of text, stripping JANE:/AUTHOR: prefixes. */
function episodeDescription(script: string | null, title: string): string {
  if (!script) return title;
  const clean = script
    .split("\n")
    .map((l) => l.replace(/^(JANE|AUTHOR):\s*/i, "").trim())
    .filter(Boolean)
    .join(" ");
  return clean.slice(0, 300) + (clean.length > 300 ? "…" : "");
}

// ─── RSS Builder ──────────────────────────────────────────────────────────────

function buildRss(episodes: Awaited<ReturnType<typeof getPublishedEpisodes>>): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const title = process.env.PODCAST_TITLE ?? "Stickler Interviews";
  const description =
    process.env.PODCAST_DESCRIPTION ??
    "AI-powered two-voice interviews with authors of the best tech articles.";
  const author = process.env.PODCAST_AUTHOR ?? "Stickler";
  const imageUrl = process.env.PODCAST_IMAGE_URL ?? "";

  const items = episodes
    .map((ep) => {
      const duration = ep.estimatedReadMin ? ep.estimatedReadMin * 60 : 0;
      const desc = episodeDescription(ep.interviewScript, ep.title);
      const epAuthor = ep.author ?? author;

      return `
    <item>
      <title>${cdata(ep.title)}</title>
      <guid isPermaLink="false">${ep.blogId}</guid>
      <pubDate>${toRfc2822(ep.processedAt)}</pubDate>
      <description>${cdata(desc)}</description>
      <enclosure url="${ep.interviewAudioUrl}" length="0" type="audio/mpeg"/>
      <itunes:duration>${duration}</itunes:duration>
      <itunes:author>${cdata(epAuthor)}</itunes:author>
      <itunes:summary>${cdata(desc)}</itunes:summary>
    </item>`.trimStart();
    })
    .join("\n    ");

  const imageTag = imageUrl
    ? `<itunes:image href="${imageUrl}"/>`
    : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"
  xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>${cdata(title)}</title>
    <link>${appUrl}</link>
    <description>${cdata(description)}</description>
    <language>en-us</language>
    <itunes:author>${cdata(author)}</itunes:author>
    ${imageTag}
    <itunes:category text="Technology"/>
    <itunes:explicit>false</itunes:explicit>
    ${items}
  </channel>
</rss>`;
}

// ─── Route Handler ────────────────────────────────────────────────────────────

/**
 * GET /api/podcast/rss.xml
 * Public RSS 2.0 feed with iTunes namespace for podcast directory submission.
 * No authentication required.
 */
export async function GET(): Promise<Response> {
  try {
    const episodes = await getPublishedEpisodes();
    const xml = buildRss(episodes);

    logger.info({ episodeCount: episodes.length }, "RSS feed served");

    return new Response(xml, {
      headers: {
        "Content-Type": "application/rss+xml; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (err) {
    logger.error({ err }, "Failed to generate RSS feed");
    return new Response("Failed to generate feed", { status: 500 });
  }
}
