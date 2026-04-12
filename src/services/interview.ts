import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { put } from "@vercel/blob";
import { logger } from "@/src/utils/logger";
import {
  getSummary,
  getInterviewStatus,
  saveInterviewAudio,
  setInterviewAudioStatus,
} from "@/src/models/summarisation";
import { getBlogContent } from "@/src/models/summarisation";
import type { InterviewSegment } from "@/src/types/summarisation";

// ─── Clients ──────────────────────────────────────────────────────────────────

function getAnthropicClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not set");
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

function getOpenAIClient(): OpenAI {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not set");
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

// ─── Script Generation ────────────────────────────────────────────────────────

/**
 * Generate a two-voice interview script from article content.
 * Jane (interviewer) asks 6–8 questions; Author answers from the article's perspective.
 * Each line is prefixed with JANE: or AUTHOR: for reliable voice routing.
 */
export async function writeInterviewScript(
  content: string,
  authorName: string | null
): Promise<string> {
  const client = getAnthropicClient();
  const author = authorName ?? "the writer";

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1536,
    messages: [
      {
        role: "user",
        content: `You are writing a two-voice podcast interview script based on an article.

Speakers:
- JANE: The interviewer. Warm, curious, asks sharp questions. Always addressed as "Jane".
- AUTHOR: ${author}, the article's author, speaking in first person from their own perspective.

Rules:
- 6–8 exchanges (JANE question → AUTHOR answer)
- Each line must start with exactly "JANE:" or "AUTHOR:" — nothing else on that line before it
- JANE lines: one question or short transition, 1–2 sentences
- AUTHOR lines: thoughtful answers, 3–5 sentences, first-person voice
- Open with Jane welcoming the author and asking about the article's core premise
- Close with Jane asking for one key takeaway; Author gives a crisp, memorable answer
- No markdown, no bullet points, no headers — flowing spoken dialogue only
- Target: 500–650 words total

Article:
${content.slice(0, 8000)}`,
      },
    ],
  });

  const block = response.content[0];
  return block.type === "text" ? block.text.trim() : "";
}

// ─── Script Parsing ───────────────────────────────────────────────────────────

/**
 * Parse a raw interview script string into speaker segments.
 * Lines not starting with JANE: or AUTHOR: are skipped.
 */
export function parseInterviewScript(script: string): InterviewSegment[] {
  const segments: InterviewSegment[] = [];
  for (const line of script.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("JANE:")) {
      const text = trimmed.slice(5).trim();
      if (text) segments.push({ speaker: "JANE", text });
    } else if (trimmed.startsWith("AUTHOR:")) {
      const text = trimmed.slice(7).trim();
      if (text) segments.push({ speaker: "AUTHOR", text });
    }
  }
  return segments;
}

// ─── Audio Generation ─────────────────────────────────────────────────────────

/**
 * Generate a two-voice interview MP3 for a blog.
 * - Fetches article content, generates Claude script, converts each segment to TTS,
 *   concatenates buffers, uploads to Vercel Blob, persists URL and script.
 * - Sets interviewAudioStatus throughout: generating → done | failed.
 */
export async function generateInterviewAudio(blogId: string): Promise<string | null> {
  const existing = await getInterviewStatus(blogId);
  if (existing?.interviewAudioStatus === "generating") {
    throw new Error("ALREADY_GENERATING");
  }

  await setInterviewAudioStatus(blogId, "generating");

  try {
    // Fetch article content
    const blogData = await getBlogContent(blogId);
    if (!blogData) throw new Error("Blog not found");

    // Use existing learningShort as content fallback (already processed text)
    const summary = await getSummary(blogId);
    const content = blogData.rawContent ?? summary?.learningShort ?? "";
    if (!content || content.trim().length < 50) {
      throw new Error("Insufficient content for interview generation");
    }

    // Generate interview script via Claude
    const script = await writeInterviewScript(content, null);
    if (!script) throw new Error("Claude returned empty script");

    const segments = parseInterviewScript(script);
    if (segments.length < 2) throw new Error("Script parsing yielded too few segments");

    logger.info({ blogId, segments: segments.length }, "Interview script generated");

    // Generate TTS for each segment sequentially (preserve dialog order)
    const openai = getOpenAIClient();
    const buffers: Buffer[] = [];

    for (const segment of segments) {
      const voice = segment.speaker === "JANE" ? "shimmer" : "onyx";
      const ttsResponse = await openai.audio.speech.create({
        model: "tts-1-hd",
        voice,
        input: segment.text,
        response_format: "mp3",
      });
      buffers.push(Buffer.from(await ttsResponse.arrayBuffer()));
    }

    // Concatenate all MP3 segments into one buffer
    const combined = Buffer.concat(buffers);

    // Upload to Vercel Blob
    const blob = await put(`audio/${blogId}-interview.mp3`, combined, {
      access: "public",
      contentType: "audio/mpeg",
      allowOverwrite: true,
    });

    await saveInterviewAudio(blogId, blob.url, script);
    logger.info({ blogId, audioUrl: blob.url }, "Interview audio generated and stored");
    return blob.url;
  } catch (err) {
    await setInterviewAudioStatus(blogId, "failed");
    logger.error({ err, blogId }, "Interview audio generation failed");
    throw err;
  }
}

// ─── Retrieval ────────────────────────────────────────────────────────────────

/**
 * Get the interview status, audio URL, and script for a blog.
 */
export async function getInterview(blogId: string): Promise<{
  interviewAudioUrl: string | null;
  interviewAudioStatus: string;
  interviewScript: string | null;
}> {
  const row = await getInterviewStatus(blogId);
  return {
    interviewAudioUrl: row?.interviewAudioUrl ?? null,
    interviewAudioStatus: row?.interviewAudioStatus ?? "none",
    interviewScript: row?.interviewScript ?? null,
  };
}
