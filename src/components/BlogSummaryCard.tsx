"use client";

import { useState, useRef, useEffect } from "react";
import type { GetSummaryResponse } from "@/src/types/summarisation";

interface Props {
  blogId: string;
  blogTitle: string;
  blogUrl: string;
  initialSummary: GetSummaryResponse | null;
}

const SPEEDS = [0.75, 1, 1.25, 1.5] as const;

/** Format seconds as mm:ss */
function fmt(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Podcast player card for a blog's learning short.
 * Shows summary bullets, keywords, and an audio player with scrub/speed/rewind controls.
 */
export function BlogSummaryCard({ blogId, blogTitle, blogUrl, initialSummary }: Props) {
  const [summary, setSummary] = useState<GetSummaryResponse | null>(initialSummary);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"summary" | "keywords" | "short" | "interview">("summary");

  // Podcast player state
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState<0.75 | 1 | 1.25 | 1.5>(1);

  // Interview player state
  const interviewAudioRef = useRef<HTMLAudioElement>(null);
  const [interviewPlaying, setInterviewPlaying] = useState(false);
  const [interviewCurrentTime, setInterviewCurrentTime] = useState(0);
  const [interviewDuration, setInterviewDuration] = useState(0);
  const [interviewSpeed, setInterviewSpeed] = useState<0.75 | 1 | 1.25 | 1.5>(1);

  // On mount, fetch existing summary if none was passed as initialSummary
  useEffect(() => {
    if (initialSummary !== null) return;
    fetch(`/api/blogs/${blogId}/summary`)
      .then((r) => r.json())
      .then((data: GetSummaryResponse) => {
        if (data.status !== "none") setSummary(data);
      })
      .catch(() => null);
  }, [blogId, initialSummary]);

  // Poll for podcast audio when status is 'generating'
  useEffect(() => {
    if (summary?.audioStatus !== "generating") return;
    const interval = setInterval(async () => {
      const res = await fetch(`/api/blogs/${blogId}/audio`);
      if (!res.ok) return;
      const data = (await res.json()) as { audioUrl: string | null; audioStatus: string; script: string | null };
      if (data.audioStatus === "done" || data.audioStatus === "failed") {
        clearInterval(interval);
        setSummary((prev) =>
          prev
            ? { ...prev, audioUrl: data.audioUrl, audioStatus: data.audioStatus as GetSummaryResponse["audioStatus"] }
            : prev
        );
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [blogId, summary?.audioStatus]);

  // Poll for interview audio when status is 'generating'
  useEffect(() => {
    if (summary?.interviewAudioStatus !== "generating") return;
    const interval = setInterval(async () => {
      const res = await fetch(`/api/blogs/${blogId}/interview`);
      if (!res.ok) return;
      const data = (await res.json()) as { interviewAudioUrl: string | null; interviewAudioStatus: string; interviewScript: string | null };
      if (data.interviewAudioStatus === "done" || data.interviewAudioStatus === "failed") {
        clearInterval(interval);
        setSummary((prev) =>
          prev
            ? {
                ...prev,
                interviewAudioUrl: data.interviewAudioUrl,
                interviewAudioStatus: data.interviewAudioStatus as GetSummaryResponse["interviewAudioStatus"],
                interviewScript: data.interviewScript,
              }
            : prev
        );
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [blogId, summary?.interviewAudioStatus]);

  async function handleProcess(force = false) {
    setLoading(true);
    setError(null);
    try {
      const url = force ? `/api/blogs/${blogId}/process?force=true` : `/api/blogs/${blogId}/process`;
      const res = await fetch(url, { method: "POST" });
      const data = (await res.json()) as { status?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Processing failed");

      // Route now returns immediately with status: "processing" — poll until done
      const processingState: GetSummaryResponse = {
        blogId,
        status: "processing",
        summaryBullets: [],
        keywords: [],
        learningShort: null,
        audioUrl: null,
        audioStatus: "none",
        interviewAudioUrl: null,
        interviewAudioStatus: "none",
        interviewScript: null,
        processedAt: null,
      };
      setSummary((prev) => prev ? { ...prev, status: "processing" } : processingState);

      const poll = setInterval(async () => {
        try {
          const summaryRes = await fetch(`/api/blogs/${blogId}/summary`);
          const summaryData = (await summaryRes.json()) as GetSummaryResponse;
          if (summaryData.status === "done" || summaryData.status === "unprocessable") {
            clearInterval(poll);
            setSummary(summaryData);
            setLoading(false);
            if (summaryData.status === "unprocessable") {
              setError("Content could not be fetched for this article.");
            }
          }
        } catch {
          // keep polling on transient errors
        }
      }, 3000);

      // Safety timeout — stop polling after 2 minutes
      setTimeout(() => {
        clearInterval(poll);
        setLoading(false);
      }, 120000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to process blog");
      setLoading(false);
    }
  }

  async function handleGenerateAudio() {
    setError(null);
    try {
      const res = await fetch(`/api/blogs/${blogId}/audio`, { method: "POST" });
      if (res.status === 409) return; // already generating
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? "Failed to start audio generation");
      }
      setSummary((prev) => prev ? { ...prev, audioStatus: "generating" } : prev);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate audio");
    }
  }

  async function handleGenerateInterview() {
    setError(null);
    try {
      const res = await fetch(`/api/blogs/${blogId}/interview`, { method: "POST" });
      if (res.status === 409) return; // already generating
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? "Failed to start interview generation");
      }
      setSummary((prev) => prev ? { ...prev, interviewAudioStatus: "generating" } : prev);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate interview");
    }
  }

  function togglePlay() {
    const el = audioRef.current;
    if (!el) return;
    if (playing) {
      el.pause();
    } else {
      void el.play();
    }
    setPlaying(!playing);
  }

  function handleRewind() {
    const el = audioRef.current;
    if (!el) return;
    el.currentTime = Math.max(0, el.currentTime - 15);
  }

  function handleSeek(e: React.ChangeEvent<HTMLInputElement>) {
    const el = audioRef.current;
    if (!el) return;
    el.currentTime = Number(e.target.value);
    setCurrentTime(Number(e.target.value));
  }

  function handleSpeedChange(s: 0.75 | 1 | 1.25 | 1.5) {
    const el = audioRef.current;
    if (el) el.playbackRate = s;
    setSpeed(s);
  }

  function toggleInterviewPlay() {
    const el = interviewAudioRef.current;
    if (!el) return;
    if (interviewPlaying) { el.pause(); } else { void el.play(); }
    setInterviewPlaying(!interviewPlaying);
  }

  function handleInterviewRewind() {
    const el = interviewAudioRef.current;
    if (!el) return;
    el.currentTime = Math.max(0, el.currentTime - 15);
  }

  function handleInterviewSeek(e: React.ChangeEvent<HTMLInputElement>) {
    const el = interviewAudioRef.current;
    if (!el) return;
    el.currentTime = Number(e.target.value);
    setInterviewCurrentTime(Number(e.target.value));
  }

  function handleInterviewSpeedChange(s: 0.75 | 1 | 1.25 | 1.5) {
    const el = interviewAudioRef.current;
    if (el) el.playbackRate = s;
    setInterviewSpeed(s);
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
          onClick={() => void handleProcess()}
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
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-2">
        <h3 className="font-semibold text-gray-900 line-clamp-2">
          <a href={blogUrl} target="_blank" rel="noopener noreferrer" className="hover:text-indigo-600">
            {blogTitle}
          </a>
        </h3>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span className="animate-spin inline-block">⏳</span>
          Generating summary… this takes about 30 seconds.
        </div>
      </div>
    );
  }

  if (summary.status === "unprocessable") {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-3">
        <h3 className="font-semibold text-gray-900 line-clamp-2">
          <a href={blogUrl} target="_blank" rel="noopener noreferrer" className="hover:text-indigo-600">
            {blogTitle}
          </a>
        </h3>
        <p className="text-sm text-red-500">
          Content unavailable — the article may be behind a paywall or could not be fetched.
        </p>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          onClick={() => void handleProcess(true)}
          disabled={loading}
          className="text-sm px-4 py-1.5 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50"
        >
          {loading ? "Retrying…" : "Try again"}
        </button>
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
        {(["summary", "keywords", "short", "interview"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 capitalize font-medium transition-colors ${
              tab === t
                ? "text-indigo-600 border-b-2 border-indigo-600"
                : "text-gray-500 hover:text-gray-800"
            }`}
          >
            {t === "short" ? "Listen" : t === "interview" ? "Interview" : t}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="p-4">
        {tab === "summary" && (() => {
          const bullets = summary.summaryBullets ?? [];
          const isCorrupted = bullets.some((b) => b.trimStart().startsWith("```"));
          if (isCorrupted || bullets.length === 0) {
            return (
              <div className="space-y-3">
                <p className="text-sm text-gray-400">Summary data is malformed. Please regenerate.</p>
                <button
                  onClick={() => void handleProcess(true)}
                  disabled={loading}
                  className="text-sm px-3 py-1.5 border border-indigo-300 text-indigo-600 rounded hover:bg-indigo-50 disabled:opacity-50 transition-colors"
                >
                  {loading ? "Regenerating…" : "Regenerate summary"}
                </button>
              </div>
            );
          }
          return (
            <ul className="space-y-2">
              {bullets.map((b, i) => (
                <li key={i} className="flex gap-2 text-sm text-gray-700">
                  <span className="text-indigo-400 font-bold shrink-0">•</span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          );
        })()}

        {tab === "keywords" && (
          (summary.keywords ?? []).length === 0 ? (
            <div className="space-y-3">
              <p className="text-sm text-gray-400">No keywords extracted yet.</p>
              <button
                onClick={() => void handleProcess(true)}
                disabled={loading}
                className="text-sm px-3 py-1.5 border border-indigo-300 text-indigo-600 rounded hover:bg-indigo-50 disabled:opacity-50 transition-colors"
              >
                {loading ? "Regenerating…" : "Regenerate keywords"}
              </button>
            </div>
          ) : (
            <dl className="space-y-3">
              {(summary.keywords ?? []).map((k, i) => (
                <div key={i}>
                  <dt className="text-sm font-semibold text-gray-900">{k.term}</dt>
                  <dd className="text-sm text-gray-600">{k.definition}</dd>
                </div>
              ))}
            </dl>
          )
        )}

        {tab === "short" && (
          <div className="space-y-4">
            {/* Script text */}
            {summary.learningShort && (
              <p className="text-sm text-gray-700 leading-relaxed line-clamp-4">
                {summary.learningShort}
              </p>
            )}

            {/* Audio player states */}
            {summary.audioStatus === "generating" && (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <span className="animate-spin">⏳</span> Generating audio…
              </div>
            )}

            {summary.audioStatus === "failed" && (
              <div className="space-y-2">
                <p className="text-sm text-red-500">Audio generation failed.</p>
                {error && <p className="text-sm text-red-600">{error}</p>}
                <button
                  onClick={handleGenerateAudio}
                  className="text-sm px-3 py-1.5 border border-red-300 text-red-600 rounded hover:bg-red-50 transition-colors"
                >
                  Retry audio
                </button>
              </div>
            )}

            {(summary.audioStatus === "none") && summary.learningShort && (
              <button
                onClick={handleGenerateAudio}
                className="flex items-center gap-2 text-sm px-3 py-1.5 border border-indigo-300 text-indigo-600 rounded hover:bg-indigo-50 transition-colors"
              >
                🎙 Generate podcast audio
              </button>
            )}

            {summary.audioStatus === "done" && summary.audioUrl && (
              <div className="space-y-3 bg-gray-50 rounded-lg p-3">
                {/* Hidden audio element */}
                <audio
                  ref={audioRef}
                  src={summary.audioUrl}
                  onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime ?? 0)}
                  onLoadedMetadata={() => setDuration(audioRef.current?.duration ?? 0)}
                  onEnded={() => setPlaying(false)}
                />

                {/* Progress bar */}
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span className="w-9 text-right tabular-nums">{fmt(currentTime)}</span>
                  <input
                    type="range"
                    min={0}
                    max={duration || 1}
                    step={1}
                    value={currentTime}
                    onChange={handleSeek}
                    className="flex-1 h-1.5 accent-indigo-600 cursor-pointer"
                  />
                  <span className="w-9 tabular-nums">{fmt(duration)}</span>
                </div>

                {/* Controls row */}
                <div className="flex items-center justify-between">
                  {/* −15s + play/pause */}
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleRewind}
                      title="Rewind 15s"
                      className="text-gray-500 hover:text-gray-800 text-lg leading-none"
                    >
                      ↺
                    </button>
                    <button
                      onClick={togglePlay}
                      className="w-9 h-9 flex items-center justify-center bg-indigo-600 text-white rounded-full hover:bg-indigo-700 transition-colors text-sm"
                    >
                      {playing ? "⏸" : "▶"}
                    </button>
                  </div>

                  {/* Speed selector */}
                  <div className="flex gap-1">
                    {SPEEDS.map((s) => (
                      <button
                        key={s}
                        onClick={() => handleSpeedChange(s)}
                        className={`text-xs px-2 py-0.5 rounded ${
                          speed === s
                            ? "bg-indigo-600 text-white"
                            : "bg-white border border-gray-200 text-gray-500 hover:border-indigo-300"
                        }`}
                      >
                        {s}×
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "interview" && (
          <div className="space-y-4">
            <p className="text-xs text-gray-400">
              Jane (interviewer) &amp; the author discuss the article — two distinct voices, one conversation.
            </p>

            {summary.interviewAudioStatus === "none" && (
              <button
                onClick={() => void handleGenerateInterview()}
                className="flex items-center gap-2 text-sm px-3 py-1.5 border border-purple-300 text-purple-600 rounded hover:bg-purple-50 transition-colors"
              >
                🎤 Generate interview podcast
              </button>
            )}

            {summary.interviewAudioStatus === "generating" && (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <span className="animate-spin">⏳</span> Generating interview… this may take a minute.
              </div>
            )}

            {summary.interviewAudioStatus === "failed" && (
              <div className="space-y-2">
                <p className="text-sm text-red-500">Interview generation failed.</p>
                {error && <p className="text-sm text-red-600">{error}</p>}
                <button
                  onClick={() => void handleGenerateInterview()}
                  className="text-sm px-3 py-1.5 border border-red-300 text-red-600 rounded hover:bg-red-50 transition-colors"
                >
                  Retry
                </button>
              </div>
            )}

            {summary.interviewAudioStatus === "done" && summary.interviewAudioUrl && (
              <div className="space-y-3 bg-purple-50 rounded-lg p-3">
                <audio
                  ref={interviewAudioRef}
                  src={summary.interviewAudioUrl}
                  onTimeUpdate={() => setInterviewCurrentTime(interviewAudioRef.current?.currentTime ?? 0)}
                  onLoadedMetadata={() => setInterviewDuration(interviewAudioRef.current?.duration ?? 0)}
                  onEnded={() => setInterviewPlaying(false)}
                />
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span className="w-9 text-right tabular-nums">{fmt(interviewCurrentTime)}</span>
                  <input
                    type="range"
                    min={0}
                    max={interviewDuration || 1}
                    step={1}
                    value={interviewCurrentTime}
                    onChange={handleInterviewSeek}
                    className="flex-1 h-1.5 accent-purple-600 cursor-pointer"
                  />
                  <span className="w-9 tabular-nums">{fmt(interviewDuration)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <button onClick={handleInterviewRewind} title="Rewind 15s" className="text-gray-500 hover:text-gray-800 text-lg leading-none">↺</button>
                    <button
                      onClick={toggleInterviewPlay}
                      className="w-9 h-9 flex items-center justify-center bg-purple-600 text-white rounded-full hover:bg-purple-700 transition-colors text-sm"
                    >
                      {interviewPlaying ? "⏸" : "▶"}
                    </button>
                  </div>
                  <div className="flex gap-1">
                    {SPEEDS.map((s) => (
                      <button
                        key={s}
                        onClick={() => handleInterviewSpeedChange(s)}
                        className={`text-xs px-2 py-0.5 rounded ${
                          interviewSpeed === s
                            ? "bg-purple-600 text-white"
                            : "bg-white border border-gray-200 text-gray-500 hover:border-purple-300"
                        }`}
                      >
                        {s}×
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Transcript (collapsible) */}
            {summary.interviewScript && summary.interviewAudioStatus === "done" && (
              <details className="text-xs text-gray-500 cursor-pointer">
                <summary className="font-medium text-gray-600 hover:text-gray-800">Show transcript</summary>
                <pre className="mt-2 whitespace-pre-wrap font-sans leading-relaxed text-gray-600">
                  {summary.interviewScript}
                </pre>
              </details>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
