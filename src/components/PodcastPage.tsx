"use client";

import { useState } from "react";
import type { PodcastEpisode } from "@/src/models/podcast";

interface Props {
  episodes: PodcastEpisode[];
  feedUrl: string;
  title: string;
  description: string;
}

function formatDate(d: Date | null): string {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

/**
 * Public podcast listing page — episode list with native audio players
 * and RSS feed subscription link.
 */
export function PodcastPage({ episodes, feedUrl, title, description }: Props) {
  const [copied, setCopied] = useState(false);

  async function copyFeedUrl() {
    await navigator.clipboard.writeText(feedUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-12 space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-gray-900">{title}</h1>
        <p className="text-gray-500">{description}</p>
      </div>

      {/* Subscribe bar */}
      <div className="flex items-center gap-3 rounded-xl border border-purple-200 bg-purple-50 px-4 py-3">
        <span className="text-sm font-medium text-purple-700 shrink-0">RSS Feed</span>
        <code className="flex-1 truncate text-xs text-purple-600">{feedUrl}</code>
        <button
          onClick={() => void copyFeedUrl()}
          className="shrink-0 text-xs px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
        <a
          href={feedUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 text-xs px-3 py-1.5 border border-purple-300 text-purple-600 rounded-lg hover:bg-purple-100 transition-colors"
        >
          Open feed
        </a>
      </div>

      {/* Directory links */}
      <div className="flex flex-wrap gap-2 text-sm">
        <span className="text-gray-500">Submit to:</span>
        <a
          href="https://podcasters.apple.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-indigo-600 hover:underline"
        >
          Apple Podcasts
        </a>
        <span className="text-gray-300">·</span>
        <a
          href="https://podcasters.spotify.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-indigo-600 hover:underline"
        >
          Spotify
        </a>
      </div>

      {/* Episode list */}
      {episodes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 p-10 text-center">
          <p className="text-gray-400 text-sm">No episodes published yet.</p>
          <p className="text-gray-400 text-xs mt-1">
            Generate interview podcasts from the Reading Calendar to see them here.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          <p className="text-sm text-gray-500">{episodes.length} episode{episodes.length !== 1 ? "s" : ""}</p>
          {episodes.map((ep) => (
            <div key={ep.blogId} className="rounded-xl border border-gray-200 bg-white p-5 space-y-3 shadow-sm">
              {/* Episode header */}
              <div className="space-y-0.5">
                <a
                  href={ep.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-gray-900 hover:text-indigo-600 line-clamp-2"
                >
                  {ep.title}
                </a>
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  {ep.source && <span className="capitalize">{ep.source}</span>}
                  {ep.estimatedReadMin && (
                    <>
                      <span>·</span>
                      <span>~{ep.estimatedReadMin * 3} min listen</span>
                    </>
                  )}
                  {ep.processedAt && (
                    <>
                      <span>·</span>
                      <span>{formatDate(ep.processedAt)}</span>
                    </>
                  )}
                </div>
              </div>

              {/* Native audio player */}
              <audio
                controls
                src={ep.interviewAudioUrl}
                className="w-full h-10"
                preload="none"
              />

              {/* Transcript preview */}
              {ep.interviewScript && (
                <details className="text-xs text-gray-500">
                  <summary className="cursor-pointer font-medium text-gray-600 hover:text-gray-800">
                    Show transcript
                  </summary>
                  <pre className="mt-2 whitespace-pre-wrap font-sans leading-relaxed text-gray-600 max-h-64 overflow-y-auto">
                    {ep.interviewScript}
                  </pre>
                </details>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
