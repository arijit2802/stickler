"use client";

import { useState } from "react";
import type { CalendarEntry, GetCalendarResponse } from "@/src/types/discovery";
import { BlogSummaryCard } from "@/src/components/BlogSummaryCard";

interface Props {
  initial: GetCalendarResponse;
}

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Return YYYY-MM-DD for each day of a week starting on Monday. */
function weekDays(mondayStr: string): string[] {
  const days: string[] = [];
  const d = new Date(mondayStr);
  for (let i = 0; i < 7; i++) {
    days.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + 1);
  }
  return days;
}

/** Offset the monday by ±7 days. */
function shiftWeek(mondayStr: string, direction: -1 | 1): string {
  const d = new Date(mondayStr);
  d.setDate(d.getDate() + direction * 7);
  return d.toISOString().slice(0, 10);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const STATUS_STYLES: Record<string, string> = {
  read: "bg-green-100 text-green-800",
  skipped: "bg-gray-100 text-gray-500 line-through",
  pending: "bg-white",
};

/**
 * Weekly reading calendar view with navigation and mark-as-read/skipped controls.
 */
export function ReadingCalendar({ initial }: Props) {
  const [weekOf, setWeekOf] = useState(initial.weekOf);
  const [entries, setEntries] = useState<CalendarEntry[]>(initial.entries);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadWeek(newMonday: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/calendar?weekOf=${newMonday}`);
      const data = (await res.json()) as GetCalendarResponse & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to load calendar");
      setWeekOf(data.weekOf);
      setEntries(data.entries);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load week");
    } finally {
      setLoading(false);
    }
  }

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

  const days = weekDays(weekOf);
  const byDate = new Map<string, CalendarEntry[]>();
  for (const entry of entries) {
    const key = entry.scheduledDate;
    if (!byDate.has(key)) byDate.set(key, []);
    byDate.get(key)!.push(entry);
  }

  return (
    <div className="space-y-4">
      {/* Week navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => loadWeek(shiftWeek(weekOf, -1))}
          disabled={loading}
          className="text-sm text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
        >
          ← Prev week
        </button>
        <span className="text-sm font-medium text-gray-700">
          {formatDate(days[0])} – {formatDate(days[6])}
        </span>
        <button
          onClick={() => loadWeek(shiftWeek(weekOf, 1))}
          disabled={loading}
          className="text-sm text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
        >
          Next week →
        </button>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-2 text-center text-xs text-gray-500">
        {DAY_LABELS.map((label) => (
          <div key={label} className="font-medium py-1">
            {label}
          </div>
        ))}

        {days.map((day, i) => {
          const dayEntries = byDate.get(day) ?? [];
          const isToday = day === new Date().toISOString().slice(0, 10);
          return (
            <div
              key={day}
              className={`rounded-lg border p-2 min-h-[80px] text-left ${
                isToday ? "border-indigo-400 bg-indigo-50" : "border-gray-200"
              }`}
            >
              <div className={`text-xs mb-1 ${isToday ? "font-semibold text-indigo-600" : "text-gray-400"}`}>
                {DAY_LABELS[i]} {formatDate(day)}
              </div>
              {dayEntries.length === 0 ? (
                <div className="text-gray-300 text-xs">—</div>
              ) : (
                <ul className="space-y-1">
                  {dayEntries.map((entry) => (
                    <li
                      key={entry.entryId}
                      className={`rounded px-1.5 py-1 text-xs ${STATUS_STYLES[entry.status]}`}
                    >
                      <a
                        href={entry.blog.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block font-medium text-gray-800 hover:text-indigo-600 line-clamp-2"
                      >
                        {entry.blog.title}
                      </a>
                      {entry.status === "pending" && (
                        <div className="flex gap-2 mt-1">
                          <button
                            onClick={() => handleMark(entry.entryId, "read")}
                            className="text-green-600 hover:underline"
                          >
                            Read ✓
                          </button>
                          <button
                            onClick={() => handleMark(entry.entryId, "skipped")}
                            className="text-gray-400 hover:underline"
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
          );
        })}
      </div>

      {loading && (
        <div className="text-center text-sm text-gray-400">Loading…</div>
      )}

      {/* Blog summaries for this week */}
      {entries.length > 0 && (
        <div className="mt-8 space-y-4">
          <h2 className="text-base font-semibold text-gray-800">Blog Summaries</h2>
          {entries.map((entry) => (
            <BlogSummaryCard
              key={entry.entryId}
              blogId={entry.blog.id}
              blogTitle={entry.blog.title}
              blogUrl={entry.blog.url}
              initialSummary={null}
            />
          ))}
        </div>
      )}
    </div>
  );
}
