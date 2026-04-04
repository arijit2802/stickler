"use client";

import { useState } from "react";
import type { SuggestionItem } from "@/src/types/discovery";

interface Props {
  initial: SuggestionItem[];
  onConfirmed: (scheduledDate: string) => void;
}

/**
 * Renders the 3 blog suggestions returned by discovery and lets the user
 * approve all, reject individual items, or request a new set.
 */
export function DiscoverySuggestions({ initial, onConfirmed }: Props) {
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>(initial);
  const [selected, setSelected] = useState<Set<string>>(
    new Set(initial.map((s) => s.suggestionId))
  );
  const [loading, setLoading] = useState(false);
  const [replacingId, setReplacingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handleReject(suggestionId: string) {
    setReplacingId(suggestionId);
    setError(null);
    try {
      const res = await fetch("/api/discovery/reject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ suggestionId }),
      });
      const data = (await res.json()) as { replacement: SuggestionItem | null; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Reject failed");

      if (data.replacement) {
        setSuggestions((prev) =>
          prev.map((s) => (s.suggestionId === suggestionId ? data.replacement! : s))
        );
        setSelected((prev) => {
          const next = new Set(prev);
          next.delete(suggestionId);
          next.add(data.replacement!.suggestionId);
          return next;
        });
      } else {
        // No replacement — just remove from list
        setSuggestions((prev) => prev.filter((s) => s.suggestionId !== suggestionId));
        setSelected((prev) => {
          const next = new Set(prev);
          next.delete(suggestionId);
          return next;
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to replace suggestion");
    } finally {
      setReplacingId(null);
    }
  }

  async function handleConfirm() {
    if (selected.size === 0) return;
    setLoading(true);
    setError(null);

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const scheduledDate = tomorrow.toISOString().slice(0, 10);

    try {
      const res = await fetch("/api/discovery/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ suggestionIds: Array.from(selected), scheduledDate }),
      });
      const data = (await res.json()) as { confirmed?: number; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Confirm failed");
      onConfirmed(scheduledDate);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to confirm blogs");
    } finally {
      setLoading(false);
    }
  }

  async function handleRefresh() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/discovery/run", { method: "POST" });
      const data = (await res.json()) as { suggestions?: SuggestionItem[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Discovery failed");
      const items = data.suggestions ?? [];
      setSuggestions(items);
      setSelected(new Set(items.map((s) => s.suggestionId)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Discovery failed");
    } finally {
      setLoading(false);
    }
  }

  if (suggestions.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 mb-4">No suggestions available.</p>
        <button
          onClick={handleRefresh}
          disabled={loading}
          className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
        >
          {loading ? "Searching…" : "Find blogs"}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">
          Today&apos;s suggestions
        </h2>
        <button
          onClick={handleRefresh}
          disabled={loading}
          className="text-sm text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
        >
          {loading ? "Searching…" : "Search again"}
        </button>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200">
        {suggestions.map((s) => (
          <li key={s.suggestionId} className="flex items-start gap-3 p-4">
            <input
              type="checkbox"
              checked={selected.has(s.suggestionId)}
              onChange={() => toggleSelect(s.suggestionId)}
              className="mt-1 h-4 w-4 rounded border-gray-300 text-indigo-600"
            />
            <div className="flex-1 min-w-0">
              <a
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-gray-900 hover:text-indigo-600 line-clamp-2"
              >
                {s.title}
              </a>
              <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                <span className="capitalize">{s.source}</span>
                {s.estimatedReadMin && (
                  <>
                    <span>·</span>
                    <span>{s.estimatedReadMin} min read</span>
                  </>
                )}
                {s.author && (
                  <>
                    <span>·</span>
                    <span>{s.author}</span>
                  </>
                )}
              </div>
              {s.summary && (
                <p className="mt-1 text-sm text-gray-600 line-clamp-2">{s.summary}</p>
              )}
            </div>
            <button
              onClick={() => handleReject(s.suggestionId)}
              disabled={replacingId === s.suggestionId || loading}
              className="shrink-0 text-xs text-gray-400 hover:text-red-500 disabled:opacity-40"
              aria-label="Replace this suggestion"
            >
              {replacingId === s.suggestionId ? "…" : "Replace"}
            </button>
          </li>
        ))}
      </ul>

      <div className="flex justify-end">
        <button
          onClick={handleConfirm}
          disabled={selected.size === 0 || loading}
          className="px-5 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium"
        >
          {loading ? "Saving…" : `Add ${selected.size} to calendar`}
        </button>
      </div>
    </div>
  );
}
