"use client";

import { useState } from "react";
import type { LearningProfileData, KnowledgeLevelItem } from "@/src/types/onboarding";

interface Props {
  initialProfile: LearningProfileData;
  onSave: (updated: LearningProfileData) => Promise<void>;
  isLoading?: boolean;
}

/**
 * Allows returning users to edit specific fields of their learning profile
 * without going through the full interview again.
 */
export default function ProfileEditForm({ initialProfile, onSave, isLoading }: Props) {
  const [profile, setProfile] = useState<LearningProfileData>(initialProfile);
  const [error, setError] = useState<string | null>(null);

  function handleRoleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setProfile((p) => ({ ...p, role: e.target.value }));
  }

  function handleMotivationChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setProfile((p) => ({ ...p, motivation: e.target.value }));
  }

  function handleKnowledgeLevelChange(topic: string, level: KnowledgeLevelItem["level"]) {
    setProfile((p) => ({
      ...p,
      knowledgeLevel: p.knowledgeLevel.map((kl) =>
        kl.topic === topic ? { ...kl, level } : kl
      ),
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!profile.role.trim()) {
      setError("Role is required");
      return;
    }
    try {
      await onSave(profile);
    } catch {
      setError("Failed to save changes. Please try again.");
    }
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-6 max-w-xl">
      {/* Role */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Your Role / Profession
        </label>
        <input
          type="text"
          value={profile.role}
          onChange={handleRoleChange}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="e.g. Software Engineer, Product Manager"
        />
      </div>

      {/* Knowledge Level per topic */}
      {profile.knowledgeLevel.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Knowledge Level by Topic
          </label>
          <div className="space-y-2">
            {profile.knowledgeLevel.map((kl, i) => (
              <div key={i} className="flex items-center gap-4">
                <span className="text-sm text-gray-700 w-40 truncate">{kl.topic}</span>
                <div className="flex gap-2">
                  {(["beginner", "intermediate", "advanced"] as const).map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => handleKnowledgeLevelChange(kl.topic, lvl)}
                      className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                        kl.level === lvl
                          ? "bg-blue-600 text-white border-blue-600"
                          : "border-gray-300 text-gray-600 hover:border-blue-400"
                      }`}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Motivation */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Why do you want to learn?
        </label>
        <textarea
          value={profile.motivation}
          onChange={handleMotivationChange}
          rows={3}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          placeholder="e.g. Stay current with AI trends, grow into a leadership role"
        />
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={isLoading}
        className="w-full bg-blue-600 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-40 transition-colors"
      >
        {isLoading ? "Saving…" : "Save Changes"}
      </button>
    </form>
  );
}
