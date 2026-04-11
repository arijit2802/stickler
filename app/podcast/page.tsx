import { getPublishedEpisodes } from "@/src/models/podcast";
import { PodcastPage } from "@/src/components/PodcastPage";

/**
 * Public podcast listing page — no authentication required.
 * Shows all published interview episodes with native audio players.
 */
export default async function Podcast() {
  const episodes = await getPublishedEpisodes();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const feedUrl = `${appUrl}/api/podcast/rss.xml`;
  const title = process.env.PODCAST_TITLE ?? "Stickler Interviews";
  const description =
    process.env.PODCAST_DESCRIPTION ??
    "AI-powered two-voice interviews with authors of the best tech articles.";

  return <PodcastPage episodes={episodes} feedUrl={feedUrl} title={title} description={description} />;
}
