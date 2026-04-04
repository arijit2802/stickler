import Anthropic from "@anthropic-ai/sdk";
import { tavily } from "@tavily/core";
import { logger } from "@/src/utils/logger";
import {
  getSummary,
  upsertSummary,
  markProcessing,
  markUnprocessable,
  getBlogContent,
} from "@/src/models/summarisation";
import type { BlogSummary } from "@/db/schema";
import type { SummaryOutput, Keyword } from "@/src/types/summarisation";

// ─── Clients ──────────────────────────────────────────────────────────────────

function getAnthropicClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

function getTavilyClient() {
  if (!process.env.TAVILY_API_KEY) {
    throw new Error("TAVILY_API_KEY is not set");
  }
  return tavily({ apiKey: process.env.TAVILY_API_KEY });
}

// ─── Content Fetching ─────────────────────────────────────────────────────────

/**
 * Fetch full article content via Tavily extract.
 * Falls back to rawContent stored in DB if extraction fails.
 */
async function fetchContent(url: string, rawContent: string | null): Promise<string | null> {
  try {
    const client = getTavilyClient();
    const result = await client.extract([url]);
    const extracted = result.results?.[0]?.rawContent ?? null;
    if (extracted && extracted.length > 100) return extracted;
  } catch (err) {
    logger.warn({ err, url }, "Tavily extract failed, falling back to rawContent");
  }
  return rawContent;
}

// ─── Claude Calls ─────────────────────────────────────────────────────────────

/**
 * Generate 3–5 bullet point summary from article content.
 */
export async function generateSummary(content: string): Promise<string[]> {
  const client = getAnthropicClient();

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 512,
    messages: [
      {
        role: "user",
        content: `Summarise this blog post in 3-5 bullet points. Each bullet should be one clear, actionable insight. Avoid filler phrases. Reply with ONLY a JSON array of strings:
["bullet 1", "bullet 2", ...]

Article:
${content.slice(0, 8000)}`,
      },
    ],
  });

  const block = response.content[0];
  if (block.type !== "text") throw new Error("Unexpected Claude response");

  try {
    const parsed = JSON.parse(block.text) as unknown;
    if (Array.isArray(parsed)) return (parsed as string[]).slice(0, 5);
    throw new Error("Not an array");
  } catch {
    // Retry once with stricter prompt
    const retry = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 512,
      messages: [
        {
          role: "user",
          content: `Extract 3-5 key insights from this article as a JSON array. ONLY output valid JSON, nothing else.
Example output: ["insight 1", "insight 2", "insight 3"]

Article: ${content.slice(0, 4000)}`,
        },
      ],
    });
    const retryBlock = retry.content[0];
    if (retryBlock.type !== "text") return [];
    try {
      const parsed = JSON.parse(retryBlock.text) as unknown;
      return Array.isArray(parsed) ? (parsed as string[]).slice(0, 5) : [];
    } catch {
      // Fallback: return raw text as single bullet
      return [retryBlock.text.slice(0, 200)];
    }
  }
}

/**
 * Extract 5–7 keywords with plain-English definitions.
 */
export async function extractKeywords(content: string): Promise<Keyword[]> {
  const client = getAnthropicClient();

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 768,
    messages: [
      {
        role: "user",
        content: `Extract 5-7 key technical or domain-specific terms from this article. For each, write a 1-sentence plain-English definition a beginner would understand.
Reply with ONLY a JSON array:
[{"term": "...", "definition": "..."}, ...]

Article:
${content.slice(0, 8000)}`,
      },
    ],
  });

  const block = response.content[0];
  if (block.type !== "text") return [];

  try {
    const parsed = JSON.parse(block.text) as unknown;
    if (!Array.isArray(parsed)) throw new Error("Not array");
    return (parsed as Keyword[]).slice(0, 7).filter(
      (k) => typeof k.term === "string" && typeof k.definition === "string"
    );
  } catch {
    return [];
  }
}

/**
 * Write a 2–3 minute conversational "Learning Short" script.
 */
export async function writeLearningShort(
  content: string,
  keywords: Keyword[]
): Promise<string> {
  const client = getAnthropicClient();
  const keyTerms = keywords.map((k) => k.term).join(", ");

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `Write a 2-3 minute spoken script based on this article. Style: conversational, like a smart friend explaining it. Include: the main idea, why it matters, and one practical takeaway. No bullet points — flowing prose only. Key terms to weave in naturally: ${keyTerms}.

Article:
${content.slice(0, 8000)}`,
      },
    ],
  });

  const block = response.content[0];
  return block.type === "text" ? block.text : "";
}

// ─── Orchestration ────────────────────────────────────────────────────────────

/**
 * Full processing pipeline for a blog:
 * fetch content → summary → keywords → learning short → persist.
 * Returns the completed BlogSummary row.
 */
export async function processBlog(blogId: string): Promise<BlogSummary> {
  // Guard: skip if already processing or done
  const existing = await getSummary(blogId);
  if (existing?.status === "processing") {
    throw new Error("Blog is already being processed");
  }
  if (existing?.status === "done") {
    return existing;
  }

  await markProcessing(blogId);

  const blogData = await getBlogContent(blogId);
  if (!blogData) {
    await markUnprocessable(blogId);
    throw new Error("Blog not found");
  }

  const content = await fetchContent(blogData.url, blogData.rawContent);

  if (!content || content.trim().length < 100) {
    logger.warn({ blogId, url: blogData.url }, "Content too short or unavailable, marking unprocessable");
    await markUnprocessable(blogId);
    throw new Error("Blog content could not be fetched");
  }

  logger.info({ blogId, contentLength: content.length }, "Processing blog");

  let output: SummaryOutput;
  try {
    const [summaryBullets, keywords] = await Promise.all([
      generateSummary(content),
      extractKeywords(content),
    ]);
    const learningShort = await writeLearningShort(content, keywords);
    output = { summaryBullets, keywords, learningShort };
  } catch (err) {
    logger.error({ err, blogId }, "Claude processing failed");
    await markUnprocessable(blogId);
    throw err;
  }

  const row = await upsertSummary({
    blogId,
    summaryBullets: output.summaryBullets,
    keywords: output.keywords,
    learningShort: output.learningShort,
    audioUrl: null,
    status: "done",
    processedAt: new Date(),
  });

  logger.info({ blogId }, "Blog processing complete");
  return row;
}

/**
 * Get existing summary or null for a blog.
 */
export async function getBlogSummary(blogId: string): Promise<BlogSummary | null> {
  return getSummary(blogId);
}
