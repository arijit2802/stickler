"use client";

import type { LearningProfileData } from "@/src/types/onboarding";

interface Props {
  profile: LearningProfileData;
  onConfirm: () => void;
  onEdit: () => void;
  isLoading: boolean;
}

/** Displays the captured learning profile for user review before saving */
export function ProfileSummaryCard({ profile, onConfirm, onEdit, isLoading }: Props) {
  return (
    <div className="bg-white rounded-2xl shadow-md border max-w-xl w-full p-6 space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-gray-800">Your Learning Profile</h2>
        <p className="text-sm text-gray-500 mt-1">
          Review your profile before we start finding blogs for you.
        </p>
      </div>

      {/* Role */}
      <Section title="Your Role">
        <p className="text-gray-700">{profile.role}</p>
      </Section>

      {/* Interests */}
      <Section title="Interests">
        <ul className="space-y-2">
          {profile.interests.map((interest, i) => (
            <li key={i} className="bg-blue-50 rounded-lg p-3">
              <p className="font-medium text-blue-800">{interest.topic}</p>
              <p className="text-sm text-blue-600 mt-0.5">{interest.depth}</p>
              {interest.keywords.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {interest.keywords.map((kw, j) => (
                    <span
                      key={j}
                      className="text-xs bg-blue-100 text-blue-700 rounded-full px-2 py-0.5"
                    >
                      {kw}
                    </span>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      </Section>

      {/* Knowledge Level */}
      {profile.knowledgeLevel.length > 0 && (
        <Section title="Knowledge Level">
          <div className="flex flex-wrap gap-2">
            {profile.knowledgeLevel.map((kl, i) => (
              <span key={i} className="text-sm bg-gray-100 text-gray-700 rounded-full px-3 py-1">
                {kl.topic}:{" "}
                <span className="font-medium capitalize">{kl.level}</span>
              </span>
            ))}
          </div>
        </Section>
      )}

      {/* Goals */}
      {profile.aspirations.length > 0 && (
        <Section title="Goals">
          <ul className="list-disc list-inside space-y-1">
            {profile.aspirations.map((a, i) => (
              <li key={i} className="text-gray-700 text-sm">
                {a.goal}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Motivation */}
      <Section title="Why You Want to Learn">
        <p className="text-gray-700 text-sm">{profile.motivation}</p>
      </Section>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <button
          onClick={onEdit}
          disabled={isLoading}
          className="flex-1 border border-gray-300 rounded-xl py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 transition-colors"
        >
          Edit Profile
        </button>
        <button
          onClick={onConfirm}
          disabled={isLoading}
          className="flex-1 bg-blue-600 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-40 transition-colors"
        >
          {isLoading ? "Saving…" : "Looks Good — Start Learning"}
        </button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">
        {title}
      </h3>
      {children}
    </div>
  );
}
