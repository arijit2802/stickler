"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ValidateUrlResponse, BlogMeta, ImportBlogResponse } from "@/src/types/blog-import";

interface Props {
  onClose: () => void;
}

function tomorrow(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Modal for manually importing a blog/article by URL.
 * Validates reachability, extracts metadata, then adds to reading calendar.
 */
export function AddBlogModal({ onClose }: Props) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [validating, setValidating] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [meta, setMeta] = useState<BlogMeta | null>(null);
  const [title, setTitle] = useState("");
  const [scheduledDate, setScheduledDate] = useState(tomorrow());

  function isValidHttpUrl(s: string) {
    return s.startsWith("http://") || s.startsWith("https://");
  }

  async function handleValidate() {
    setError(null);
    setWarning(null);
    setMeta(null);

    if (!isValidHttpUrl(url.trim())) {
      setError("URL must start with http:// or https://");
      return;
    }

    setValidating(true);
    try {
      const res = await fetch("/api/blogs/import/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = (await res.json()) as ValidateUrlResponse;

      if (!data.valid) {
        setError(data.reason ?? "This URL could not be validated.");
        return;
      }
      if (data.duplicate) {
        setWarning("This article is already in your calendar.");
      }
      if (data.meta) {
        setMeta(data.meta);
        setTitle(data.meta.title);
      }
    } catch {
      setError("Network error — please try again.");
    } finally {
      setValidating(false);
    }
  }

  async function handleAdd() {
    if (!meta) return;
    setAdding(true);
    setError(null);

    try {
      const res = await fetch("/api/blogs/import/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: meta.url,
          title: title.trim() || meta.title,
          source: meta.source,
          scheduledDate,
        }),
      });

      if (res.status === 409) {
        setError("This article is already in your calendar.");
        return;
      }
      if (!res.ok) {
        const d = (await res.json()) as { error?: string };
        setError(d.error ?? "Failed to add article.");
        return;
      }

      (await res.json()) as ImportBlogResponse;
      onClose();
      router.push("/calendar");
      router.refresh();
    } catch {
      setError("Network error — please try again.");
    } finally {
      setAdding(false);
    }
  }

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Add an article</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
        </div>

        {/* URL input */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Article URL</label>
          <div className="flex gap-2">
            <input
              type="url"
              value={url}
              onChange={(e) => { setUrl(e.target.value); setMeta(null); setError(null); setWarning(null); }}
              onKeyDown={(e) => { if (e.key === "Enter") void handleValidate(); }}
              placeholder="https://example.com/article"
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
            <button
              onClick={() => void handleValidate()}
              disabled={validating || !url.trim()}
              className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {validating ? "Checking…" : "Check link"}
            </button>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          {warning && <p className="text-sm text-amber-600">{warning}</p>}
        </div>

        {/* Metadata preview */}
        {meta && (
          <div className="space-y-3 border border-gray-200 rounded-xl p-4 bg-gray-50">
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Title (editable)</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
            <div className="flex gap-4 text-sm text-gray-500">
              <span className="capitalize">{meta.source}</span>
              {meta.estimatedReadMin && (
                <span>{meta.estimatedReadMin} min read</span>
              )}
            </div>

            {/* Date picker */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Schedule for</label>
              <input
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>

            {/* Add button */}
            <button
              onClick={() => void handleAdd()}
              disabled={adding || !!warning}
              className="w-full py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {adding ? "Adding…" : "Add to Calendar"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
