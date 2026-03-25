import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { resolveDbUser } from "@/src/utils/api-helpers";
import { getProfile } from "@/src/models/onboarding";
import OnboardingPageClient from "./OnboardingPageClient";

/**
 * Server component — resolves auth, checks if profile already exists,
 * then renders the client-side chat or profile edit view.
 */
export default async function OnboardingPage() {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");

  const dbUser = await resolveDbUser();
  if (!dbUser) redirect("/sign-in");

  const existingProfile = await getProfile(dbUser.id);

  return (
    <OnboardingPageClient
      hasExistingProfile={existingProfile?.isConfirmed ?? false}
      existingProfile={
        existingProfile
          ? {
              role: existingProfile.role ?? "",
              interests:
                (existingProfile.interests as {
                  topic: string;
                  depth: string;
                  keywords: string[];
                }[]) ?? [],
              aspirations:
                (existingProfile.aspirations as {
                  goal: string;
                  priority: number;
                }[]) ?? [],
              knowledgeLevel:
                (existingProfile.knowledgeLevel as {
                  topic: string;
                  level: "beginner" | "intermediate" | "advanced";
                }[]) ?? [],
              motivation: existingProfile.motivation ?? "",
            }
          : null
      }
    />
  );
}
