"use client";

import { useState, useRef, useEffect } from "react";
import type {
  ConversationMessage,
  LearningProfileData,
  RespondResponse,
  StartSessionResponse,
} from "@/src/types/onboarding";
import { ProfileSummaryCard } from "./ProfileSummaryCard";

interface Props {
  onComplete: (profileData: LearningProfileData) => void;
}

/** Full-screen chat interface for the onboarding interview */
export default function OnboardingChat({ onComplete }: Props) {
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingProfile, setPendingProfile] = useState<LearningProfileData | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Start session on mount
  useEffect(() => {
    void initSession();
  }, []);

  // Auto-scroll to latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function initSession() {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/onboarding/start", { method: "POST" });
      if (!res.ok) throw new Error("Failed to start session");
      const data = (await res.json()) as StartSessionResponse;
      setSessionId(data.sessionId);
      setMessages([{ role: "assistant", content: data.message }]);
    } catch {
      setError("Could not connect to the interview. Please refresh and try again.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSend() {
    if (!input.trim() || !sessionId || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    setError(null);
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);

    try {
      const res = await fetch("/api/onboarding/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, message: userMessage }),
      });

      if (!res.ok) {
        const err = (await res.json()) as { error: string };
        throw new Error(err.error ?? "Something went wrong");
      }

      const data = (await res.json()) as RespondResponse;
      setMessages((prev) => [...prev, { role: "assistant", content: data.message }]);

      if (data.isComplete && data.profileData) {
        setPendingProfile(data.profileData);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      setError(message);
      // Remove the optimistically added user message on error
      setMessages((prev) => prev.slice(0, -1));
      setInput(userMessage);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleConfirm(profileData: LearningProfileData) {
    if (!sessionId) return;
    setIsLoading(true);
    try {
      const res = await fetch("/api/onboarding/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, profileData }),
      });
      if (!res.ok) throw new Error("Failed to save profile");
      onComplete(profileData);
    } catch {
      setError("Failed to save your profile. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }

  // Show profile summary for confirmation
  if (pendingProfile) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <ProfileSummaryCard
          profile={pendingProfile}
          onConfirm={() => void handleConfirm(pendingProfile)}
          onEdit={() => setPendingProfile(null)}
          isLoading={isLoading}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b px-6 py-4 shadow-sm">
        <h1 className="text-xl font-semibold text-gray-800">
          Stickler — Getting to know you
        </h1>
        <p className="text-sm text-gray-500">
          Tell us about your interests and we&apos;ll curate your learning feed
        </p>
      </header>

      {/* Messages */}
      <main className="flex-1 overflow-y-auto px-4 py-6 max-w-2xl w-full mx-auto space-y-4">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === "user"
                  ? "bg-blue-600 text-white rounded-br-sm"
                  : "bg-white text-gray-800 shadow-sm border rounded-bl-sm"
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white border shadow-sm rounded-2xl rounded-bl-sm px-4 py-3">
              <span className="flex gap-1">
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
              </span>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div ref={bottomRef} />
      </main>

      {/* Input */}
      <footer className="bg-white border-t px-4 py-4">
        <div className="max-w-2xl mx-auto flex gap-3 items-end">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your answer… (Enter to send, Shift+Enter for new line)"
            rows={2}
            disabled={isLoading || !sessionId}
            className="flex-1 resize-none rounded-xl border border-gray-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          />
          <button
            onClick={() => void handleSend()}
            disabled={isLoading || !input.trim() || !sessionId}
            className="bg-blue-600 text-white rounded-xl px-5 py-3 text-sm font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Send
          </button>
        </div>
      </footer>
    </div>
  );
}
