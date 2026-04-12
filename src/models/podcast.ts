import { eq } from "drizzle-orm";
import { db } from "@/db";
import { blogSummaries, blogs } from "@/db/schema";

export interface PodcastEpisode {
  blogId: string;
  title: string;
  url: string;
  source: string | null;
  author: string | null;
  estimatedReadMin: number | null;
  interviewAudioUrl: string;
  interviewScript: string | null;
  processedAt: Date | null;
}

/**
 * Fetch all published interview episodes (interviewAudioStatus = 'done'),
 * ordered newest first. Returns only episodes with a valid audio URL.
 */
export async function getPublishedEpisodes(): Promise<PodcastEpisode[]> {
  const rows = await db
    .select({
      blogId: blogSummaries.blogId,
      title: blogs.title,
      url: blogs.url,
      source: blogs.source,
      author: blogs.author,
      estimatedReadMin: blogs.estimatedReadMin,
      interviewAudioUrl: blogSummaries.interviewAudioUrl,
      interviewScript: blogSummaries.interviewScript,
      processedAt: blogSummaries.processedAt,
    })
    .from(blogSummaries)
    .innerJoin(blogs, eq(blogSummaries.blogId, blogs.id))
    .where(eq(blogSummaries.interviewAudioStatus, "done"));

  return rows
    .filter((r): r is PodcastEpisode =>
      r.interviewAudioUrl !== null && r.interviewAudioUrl.length > 0
    )
    .sort((a, b) => {
      const tA = a.processedAt?.getTime() ?? 0;
      const tB = b.processedAt?.getTime() ?? 0;
      return tB - tA;
    });
}
