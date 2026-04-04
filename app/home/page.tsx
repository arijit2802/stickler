import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { resolveDbUser } from "@/src/utils/api-helpers";
import { getProfile } from "@/src/models/onboarding";
import { getWeek } from "@/src/services/calendar";
import { HomeDashboard } from "@/src/components/HomeDashboard";

/**
 * Home page server component — for returning users who have a confirmed profile.
 * Fetches current week's calendar entries server-side and passes them as initial data.
 */
export default async function HomePage() {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");

  const dbUser = await resolveDbUser();
  if (!dbUser) redirect("/sign-in");

  const profile = await getProfile(dbUser.id);
  if (!profile?.isConfirmed) redirect("/onboarding");

  const calendarData = await getWeek(dbUser.id);

  return (
    <main className="min-h-screen bg-gray-50">
      <HomeDashboard
        initial={calendarData}
        userName={dbUser.email.split("@")[0]}
      />
    </main>
  );
}
