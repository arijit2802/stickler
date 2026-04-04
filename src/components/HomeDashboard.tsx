"use client";

import { useState } from "react";
import Link from "next/link";
import type { CalendarEntry, GetCalendarResponse } from "@/src/types/discovery";

interface Props {
  initial: GetCalendarResponse;
  userName: string;
}

const STATUS_STYLES: Record<string, string> = {
  read: "bg-green-100 text-green-800",
  skipped: "bg-gray-100 text-gray-500 line-through",
  pending: "bg-white border border-gray-200",
};

const STATUS_LABELS: Record<string, string> = {
  read: "Read",
  skipped: "Skipped",
  pending: "Pending",
};

/**
 * Home dashboard for returning users — shows this week's reading list
 * with inline mark-as-read/skipped controls and quick-nav actions.
 */
export function HomeDashboard({ initial, userName }: Props) {
  const [entries, setEntries] = useState<CalendarEntry[]>(initial.entries);
  const [error, setError] = useState<string | null>(null);

  async function handleMark(entryId: string, status: "read" | "skipped") {
    try {
      const res = await fetch("/api/calendar", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryId, status }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? "Update failed");
      }
      setEntries((prev) =>
        prev.map((e) => (e.entryId === entryId ? { ...e, status } : e))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update entry");
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8 py-10 px-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome back{userName ? `, ${userName}` : ""}
        </h1>
        <p className="text-sm text-gray-500 mt-1">Here&apos;s your reading list for this week.</p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-3 gap-3">
        <Link
          href="/discovery"
          className="flex flex-col items-center justify-center rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-sm font-medium text-indigo-700 hover:bg-indigo-100 transition-colors text-center"
        >
          <span className="text-xl mb-1">🔍</span>
          Find New Blogs
        </Link>
        <Link
          href="/calendar"
          className="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors text-center"
        >
          <span className="text-xl mb-1">📅</span>
          Full Calendar
        </Link>
        <Link
          href="/onboarding"
          className="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors text-center"
        >
          <span className="text-xl mb-1">✏️</span>
          Update Interests
        </Link>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      {/* This Week's Reading List */}
      <div>
        <h2 className="text-base font-semibold text-gray-800 mb-3">This Week</h2>
        {entries.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center">
            <p className="text-gray-500 text-sm mb-3">No blogs scheduled this week. Go find some!</p>
            <Link
              href="/discovery"
              className="inline-block px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Find New Blogs
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-gray-200 rounded-xl border border-gray-200 overflow-hidden">
            {entries.map((entry) => (
              <li key={entry.entryId} className="p-4 flex items-start gap-4">
                {/* Status badge */}
                <span
                  className={`shrink-0 mt-0.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[entry.status]}`}
                >
                  {STATUS_LABELS[entry.status]}
                </span>

                {/* Blog info */}
                <div className="flex-1 min-w-0">
                  <a
                    href={entry.blog.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-gray-900 hover:text-indigo-600 line-clamp-2"
                  >
                    {entry.blog.title}
                  </a>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-gray-400">
                    {entry.blog.source && <span className="capitalize">{entry.blog.source}</span>}
                    {entry.blog.estimatedReadMin && (
                      <>
                        <span>·</span>
                        <span>{entry.blog.estimatedReadMin} min read</span>
                      </>
                    )}
                    <span>·</span>
                    <span>{entry.scheduledDate}</span>
                  </div>
                </div>

                {/* Mark controls — only for pending entries */}
                {entry.status === "pending" && (
                  <div className="shrink-0 flex gap-2">
                    <button
                      onClick={() => handleMark(entry.entryId, "read")}
                      className="text-xs text-green-600 hover:underline"
                    >
                      Read ✓
                    </button>
                    <button
                      onClick={() => handleMark(entry.entryId, "skipped")}
                      className="text-xs text-gray-400 hover:underline"
                    >
                      Skip
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
