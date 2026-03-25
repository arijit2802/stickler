"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import OnboardingChat from "@/src/components/OnboardingChat";
import ProfileEditForm from "@/src/components/ProfileEditForm";
import type { LearningProfileData } from "@/src/types/onboarding";

interface Props {
  hasExistingProfile: boolean;
  existingProfile: LearningProfileData | null;
}

export default function OnboardingPageClient({ hasExistingProfile, existingProfile }: Props) {
  const router = useRouter();
  const [showEdit, setShowEdit] = useState(hasExistingProfile);
  const [isSaving, setIsSaving] = useState(false);

  function handleChatComplete(_profileData: LearningProfileData) {
    // Profile saved via /api/onboarding/confirm — redirect to dashboard (Feature 2)
    router.push("/dashboard");
  }

  async function handleProfileUpdate(updated: LearningProfileData) {
    setIsSaving(true);
    try {
      const res = await fetch("/api/onboarding/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated),
      });
      if (!res.ok) throw new Error("Failed to update profile");
      router.push("/dashboard");
    } finally {
      setIsSaving(false);
    }
  }

  // Returning user — show edit form
  if (showEdit && existingProfile) {
    return (
      <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-md border p-6 w-full max-w-xl">
          <div className="mb-6">
            <h1 className="text-xl font-semibold text-gray-800">Update Your Profile</h1>
            <p className="text-sm text-gray-500 mt-1">
              Edit your details — no need to redo the full interview.
            </p>
          </div>
          <ProfileEditForm
            initialProfile={existingProfile}
            onSave={handleProfileUpdate}
            isLoading={isSaving}
          />
          <button
            onClick={() => setShowEdit(false)}
            className="mt-4 text-sm text-blue-600 hover:underline"
          >
            Redo full interview instead
          </button>
        </div>
      </main>
    );
  }

  // New user or redoing interview
  return <OnboardingChat onComplete={handleChatComplete} />;
}
