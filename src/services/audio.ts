import OpenAI from "openai";
import { put } from "@vercel/blob";
import { logger } from "@/src/utils/logger";
import { getSummary, saveAudioUrl, setAudioStatus } from "@/src/models/summarisation";

// ─── Client ───────────────────────────────────────────────────────────────────

function getOpenAIClient(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set");
  }
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

// ─── Audio Generation ─────────────────────────────────────────────────────────

/**
 * Generate an MP3 audio file from a podcast script using OpenAI TTS,
 * upload it to Vercel Blob, and persist the public URL to the DB.
 * Sets audio_status throughout: generating → done | failed.
 */
export async function generateAudio(script: string, blogId: string): Promise<string | null> {
  if (!script.trim()) {
    logger.warn({ blogId }, "Empty script — skipping audio generation");
    return null;
  }

  await setAudioStatus(blogId, "generating");

  try {
    const client = getOpenAIClient();

    const response = await client.audio.speech.create({
      model: "tts-1-hd",
      voice: "onyx",
      input: script,
      response_format: "mp3",
    });

    const buffer = Buffer.from(await response.arrayBuffer());

    const blob = await put(`audio/${blogId}.mp3`, buffer, {
      access: "public",
      contentType: "audio/mpeg",
      allowOverwrite: true,
    });

    await saveAudioUrl(blogId, blob.url); // also sets audioStatus = 'done'

    logger.info({ blogId, audioUrl: blob.url }, "Audio generated and stored");
    return blob.url;
  } catch (err) {
    await setAudioStatus(blogId, "failed");
    logger.error({ err, blogId }, "Audio generation failed");
    return null;
  }
}

// ─── Audio Retrieval ──────────────────────────────────────────────────────────

/**
 * Retrieve the stored audio URL, status, and script for a blog.
 */
export async function getAudioUrl(
  blogId: string
): Promise<{ audioUrl: string | null; audioStatus: string; script: string | null }> {
  const summary = await getSummary(blogId);
  if (!summary) return { audioUrl: null, audioStatus: "none", script: null };
  return {
    audioUrl: summary.audioUrl,
    audioStatus: summary.audioStatus ?? "none",
    script: summary.learningShort,
  };
}
