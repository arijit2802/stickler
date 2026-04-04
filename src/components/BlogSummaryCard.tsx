"use client";

import { useState, useRef } from "react";
import type { GetSummaryResponse } from "@/src/types/summarisation";

interface Props {
  blogId: string;
  blogTitle: string;
  blogUrl: string;
  initialSummary: GetSummaryResponse | null;
}

/**
 * Card displaying summary bullets, keywords, and a Learning Short player.
 * Fetches/triggers processing if the blog hasn't been processed yet.
 * Audio falls back to browser speechSynthesis if no audio URL is stored.
 */
export function BlogSummaryCard({ blogId, blogTitle, blogUrl, initialSummary }: Props) {
  const [summary, setSummary] = useState<GetSummaryResponse | null>(initialSummary);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const [tab, setTab] = useState<"summary" | "keywords" | "short">("summary");
  const synthRef = useRef<SpeechSynthesisUtterance | null>(null);

  async function handleProcess() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/blogs/${blogId}/process`, { method: "POST" });
      const data = (await res.json()) as { status?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Processing failed");
      if (data.status === "unprocessable") {
        setError("This blog could not be processed (content unavailable).");
        return;
      }
      // Reload summary
      const summaryRes = await fetch(`/api/blogs/${blogId}/summary`);
      const summaryData = (await summaryRes.json()) as GetSummaryResponse;
      setSummary(summaryData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to process blog");
    } finally {
      setLoading(false);
    }
  }

  function handleSpeak() {
    const script = summary?.learningShort;
    if (!script) return;

    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(script);
    utterance.rate = 0.95;
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    synthRef.current = utterance;
    window.speechSynthesis.speak(utterance);
    setSpeaking(true);
  }

  // Not yet processed
  if (!summary || summary.status === "none") {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-3">
        <h3 className="font-semibold text-gray-900 line-clamp-2">
          <a href={blogUrl} target="_blank" rel="noopener noreferrer" className="hover:text-indigo-600">
            {blogTitle}
          </a>
        </h3>
        <p className="text-sm text-gray-500">No summary yet.</p>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          onClick={handleProcess}
          disabled={loading}
          className="text-sm px-4 py-1.5 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
        >
          {loading ? "Processing…" : "Generate summary"}
        </button>
      </div>
    );
  }

  if (summary.status === "processing") {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <p className="text-sm text-gray-500">Processing… check back in a moment.</p>
      </div>
    );
  }

  if (summary.status === "unprocessable") {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="font-semibold text-gray-900 line-clamp-2 mb-1">
          <a href={blogUrl} target="_blank" rel="noopener noreferrer" className="hover:text-indigo-600">
            {blogTitle}
          </a>
        </h3>
        <p className="text-sm text-red-500">Content unavailable for summarisation.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-100">
        <h3 className="font-semibold text-gray-900 line-clamp-2">
          <a href={blogUrl} target="_blank" rel="noopener noreferrer" className="hover:text-indigo-600">
            {blogTitle}
          </a>
        </h3>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-100 text-sm">
        {(["summary", "keywords", "short"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 capitalize font-medium transition-colors ${
              tab === t
                ? "text-indigo-600 border-b-2 border-indigo-600"
                : "text-gray-500 hover:text-gray-800"
            }`}
          >
            {t === "short" ? "Learning Short" : t}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="p-4">
        {tab === "summary" && (
          <ul className="space-y-2">
            {summary.summaryBullets.map((b, i) => (
              <li key={i} className="flex gap-2 text-sm text-gray-700">
                <span className="text-indigo-400 font-bold shrink-0">•</span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
        )}

        {tab === "keywords" && (
          <dl className="space-y-3">
            {summary.keywords.map((k, i) => (
              <div key={i}>
                <dt className="text-sm font-semibold text-gray-900">{k.term}</dt>
                <dd className="text-sm text-gray-600">{k.definition}</dd>
              </div>
            ))}
          </dl>
        )}

        {tab === "short" && (
          <div className="space-y-3">
            {summary.learningShort ? (
              <>
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap line-clamp-6">
                  {summary.learningShort}
                </p>
                <button
                  onClick={handleSpeak}
                  className={`flex items-center gap-2 text-sm px-3 py-1.5 rounded border transition-colors ${
                    speaking
                      ? "border-red-300 text-red-600 hover:bg-red-50"
                      : "border-indigo-300 text-indigo-600 hover:bg-indigo-50"
                  }`}
                >
                  {speaking ? "⏹ Stop" : "▶ Listen (browser TTS)"}
                </button>
              </>
            ) : (
              <p className="text-sm text-gray-400">Learning short not available.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
