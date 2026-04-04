import { logger } from "@/src/utils/logger";
import { getSummary, saveAudioUrl } from "@/src/models/summarisation";

// ─── AudioService ─────────────────────────────────────────────────────────────
// MVP: No TTS provider configured. Audio URL is null; the frontend falls back
// to the browser's Web Speech API (speechSynthesis) using the script text.
// Hook: set ELEVENLABS_API_KEY + implement generateAudio() to enable server TTS.

/**
 * Attempt to generate audio for a blog's learning short.
 * Currently a no-op stub — returns null until a TTS provider is configured.
 * Stores audio URL in DB if generation succeeds.
 */
export async function generateAudio(
  _script: string,
  _blogId: string
): Promise<string | null> {
  // Future: call ElevenLabs or another TTS provider here.
  // const apiKey = process.env.ELEVENLABS_API_KEY;
  // if (!apiKey) return null;
  // ...
  logger.info({ _blogId }, "TTS provider not configured — skipping audio generation");
  return null;
}

/**
 * Retrieve the stored audio URL and script for a blog.
 * Returns script as fallback when audio is unavailable.
 */
export async function getAudioUrl(
  blogId: string
): Promise<{ audioUrl: string | null; script: string | null }> {
  const summary = await getSummary(blogId);
  if (!summary) return { audioUrl: null, script: null };
  return { audioUrl: summary.audioUrl, script: summary.learningShort };
}

/**
 * Persist a TTS-generated audio URL to the summary row.
 */
export async function storeAudioUrl(blogId: string, audioUrl: string): Promise<void> {
  await saveAudioUrl(blogId, audioUrl);
  logger.info({ blogId, audioUrl }, "Audio URL stored");
}
