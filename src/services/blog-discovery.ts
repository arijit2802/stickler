import Anthropic from "@anthropic-ai/sdk";
import { tavily } from "@tavily/core";
import { logger } from "@/src/utils/logger";
import { getProfile } from "@/src/models/onboarding";
import {
  upsertBlog,
  getSeenUrls,
  saveSearchQuery,
  saveSuggestions,
  getPendingSuggestions,
  updateSuggestionStatus,
} from "@/src/models/discovery";
import type { LearningProfile } from "@/db/schema";
import type { BlogCandidate, SuggestionItem } from "@/src/types/discovery";

// ─── Constants ────────────────────────────────────────────────────────────────

const BLOG_SOURCES = [
  "medium.com",
  "substack.com",
  "dev.to",
  "news.ycombinator.com",
  "openai.com/blog",
  "deepmind.google/blog",
  "anthropic.com/news",
  "huggingface.co/blog",
  "kdnuggets.com",
  "newsletter.datasciencedaily.com",
];

const SUGGESTIONS_TARGET = 3;

// ─── Clients ──────────────────────────────────────────────────────────────────

function getAnthropicClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY environment variable is not set");
  }
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

function getTavilyClient() {
  if (!process.env.TAVILY_API_KEY) {
    throw new Error("TAVILY_API_KEY environment variable is not set");
  }
  return tavily({ apiKey: process.env.TAVILY_API_KEY });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Estimate reading time from content length (avg 200 wpm). */
function estimateReadMin(content: string | null | undefined): number {
  if (!content) return 5;
  const words = content.trim().split(/\s+/).length;
  return Math.max(1, Math.round(words / 200));
}

/** Detect which blog source a URL belongs to. */
function detectSource(url: string): string {
  for (const source of BLOG_SOURCES) {
    if (url.includes(source)) return source.split(".")[0];
  }
  return new URL(url).hostname.replace("www.", "");
}

// ─── Core Service Functions ───────────────────────────────────────────────────

/**
 * Generate 3 targeted Tavily search queries tailored to the user's learning profile.
 */
export async function generateSearchQueries(
  profile: LearningProfile
): Promise<string[]> {
  const client = getAnthropicClient();

  const interests = (profile.interests as { topic: string; depth: string; keywords: string[] }[]) ?? [];
  const knowledgeLevels = (profile.knowledgeLevel as { topic: string; level: string }[]) ?? [];

  const profileSummary = interests
    .map((i) => {
      const level = knowledgeLevels.find((k) => k.topic === i.topic)?.level ?? "intermediate";
      return `${i.topic} (${level}, keywords: ${i.keywords?.join(", ")})`;
    })
    .join("; ");

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 512,
    messages: [
      {
        role: "user",
        content: `You are a search query generator for a blog recommendation system.
Given this user's learning profile: ${profileSummary}
Role: ${profile.role ?? "professional"}
Motivation: ${profile.motivation ?? "learning"}

Generate exactly 3 distinct search queries to find relevant, high-quality blog posts.
Each query should target different aspects of their interests.
Search only across: ${BLOG_SOURCES.join(", ")}

Reply with ONLY a JSON array of 3 strings, no explanation:
["query 1", "query 2", "query 3"]`,
      },
    ],
  });

  const block = response.content[0];
  if (block.type !== "text") throw new Error("Unexpected Claude response type");

  try {
    const queries = JSON.parse(block.text) as unknown;
    if (!Array.isArray(queries) || queries.length === 0) {
      throw new Error("Invalid queries format");
    }
    return (queries as string[]).slice(0, 3);
  } catch {
    logger.warn({ text: block.text }, "Failed to parse search queries from Claude");
    // Fallback: use top interest as a plain query
    const topInterest = interests[0]?.topic ?? "technology";
    return [`${topInterest} blog`, `${topInterest} tutorial`, `${topInterest} best practices`];
  }
}

/**
 * Execute Tavily searches for the given queries and return raw results.
 */
export async function searchBlogs(
  queries: string[]
): Promise<BlogCandidate[]> {
  const client = getTavilyClient();
  const allCandidates: BlogCandidate[] = [];

  for (const query of queries) {
    try {
      const result = await client.search(query, {
        searchDepth: "advanced",
        maxResults: 5,
        includeDomains: BLOG_SOURCES,
      });

      for (const r of result.results ?? []) {
        allCandidates.push({
          url: r.url,
          title: r.title ?? "Untitled",
          source: detectSource(r.url),
          summary: r.content?.slice(0, 300) ?? "",
          author: null,
          publishedAt: r.publishedDate ?? null,
          estimatedReadMin: estimateReadMin(r.content),
        });
      }
    } catch (err) {
      logger.warn({ err, query }, "Tavily search failed for query, skipping");
    }
  }

  return allCandidates;
}

/**
 * Score, deduplicate against seen URLs, and return the top N candidates.
 * Falls back to a broader retry search if fewer than target results found.
 */
export async function rankAndFilter(
  candidates: BlogCandidate[],
  userId: string,
  target = SUGGESTIONS_TARGET
): Promise<BlogCandidate[]> {
  const seenUrls = new Set(await getSeenUrls(userId));

  // Deduplicate by URL and filter seen
  const seen = new Set<string>();
  const filtered = candidates.filter((c) => {
    if (seenUrls.has(c.url) || seen.has(c.url)) return false;
    seen.add(c.url);
    return true;
  });

  // Simple scoring: prefer entries with summaries and estimated read time
  const scored = filtered
    .map((c) => ({
      candidate: c,
      score:
        (c.summary.length > 100 ? 2 : 0) +
        (c.estimatedReadMin !== null ? 1 : 0) +
        (c.publishedAt !== null ? 1 : 0),
    }))
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, target).map((s) => s.candidate);
}

/**
 * Persist blog candidates to DB and create pending suggestion rows.
 * Returns suggestion items ready to present to the user.
 */
export async function saveSuggestionsForUser(
  userId: string,
  candidates: BlogCandidate[]
): Promise<SuggestionItem[]> {
  const blogIds: string[] = [];

  for (const c of candidates) {
    const blog = await upsertBlog({
      url: c.url,
      title: c.title,
      source: c.source,
      summary: c.summary,
      author: c.author,
      publishedAt: c.publishedAt ? new Date(c.publishedAt) : null,
      estimatedReadMin: c.estimatedReadMin,
    });
    blogIds.push(blog.id);
  }

  const suggestions = await saveSuggestions(userId, blogIds);

  return suggestions.map((s, i) => ({
    suggestionId: s.id,
    blogId: s.blogId,
    url: candidates[i].url,
    title: candidates[i].title,
    source: candidates[i].source,
    summary: candidates[i].summary,
    author: candidates[i].author,
    estimatedReadMin: candidates[i].estimatedReadMin,
    expiresAt: s.expiresAt.toISOString(),
  }));
}

/**
 * Full discovery pipeline: generate queries → search → rank → persist.
 * Returns suggestions ready to show the user.
 */
export async function runDiscovery(userId: string): Promise<SuggestionItem[]> {
  const profile = await getProfile(userId);
  if (!profile) {
    throw new Error("User has no learning profile — complete onboarding first");
  }

  const queries = await generateSearchQueries(profile);
  logger.info({ userId, queries }, "Generated search queries");

  let candidates = await searchBlogs(queries);

  // Audit all queries
  for (const query of queries) {
    await saveSearchQuery(
      userId,
      query,
      candidates.map((c) => c.url)
    );
  }

  const ranked = await rankAndFilter(candidates, userId);

  // Fallback: if fewer than target, broaden search
  if (ranked.length < SUGGESTIONS_TARGET) {
    logger.info({ userId, found: ranked.length }, "Fewer than target results, broadening search");
    const interests = (profile.interests as { topic: string }[]) ?? [];
    const broadQuery = interests.map((i) => i.topic).join(" OR ") + " blog";
    const extraCandidates = await searchBlogs([broadQuery]);
    const combined = [...ranked, ...extraCandidates];
    const reRanked = await rankAndFilter(combined, userId);
    return saveSuggestionsForUser(userId, reRanked);
  }

  return saveSuggestionsForUser(userId, ranked);
}

/**
 * Get current pending suggestions for the user.
 */
export async function getCurrentSuggestions(userId: string): Promise<SuggestionItem[]> {
  const rows = await getPendingSuggestions(userId);
  return rows.map((r) => ({
    suggestionId: r.id,
    blogId: r.blogId,
    url: r.blog.url,
    title: r.blog.title,
    source: r.blog.source ?? "",
    summary: r.blog.summary ?? "",
    author: r.blog.author,
    estimatedReadMin: r.blog.estimatedReadMin,
    expiresAt: r.expiresAt.toISOString(),
  }));
}

/**
 * Reject a suggestion and find a replacement.
 * Returns a new SuggestionItem or null if no replacement found.
 */
export async function rejectAndReplace(
  userId: string,
  suggestionId: string
): Promise<SuggestionItem | null> {
  await updateSuggestionStatus(suggestionId, "rejected");

  const profile = await getProfile(userId);
  if (!profile) return null;

  // Run a fresh search with a slightly different angle
  const queries = await generateSearchQueries(profile);
  const candidates = await searchBlogs([queries[0] ?? ""]);
  const ranked = await rankAndFilter(candidates, userId, 1);

  if (ranked.length === 0) return null;

  const [replacement] = await saveSuggestionsForUser(userId, [ranked[0]]);
  return replacement ?? null;
}
