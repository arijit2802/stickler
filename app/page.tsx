import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { resolveDbUser } from "@/src/utils/api-helpers";
import { getProfile } from "@/src/models/onboarding";

/**
 * Root page — routes authenticated users based on whether they have a saved profile.
 * - No session → /sign-in
 * - Session + no profile → /onboarding (new user)
 * - Session + profile exists → /home (returning user)
 */
export default async function Home() {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");

  const dbUser = await resolveDbUser();
  if (!dbUser) redirect("/sign-in");

  const profile = await getProfile(dbUser.id);
  if (profile?.isConfirmed) {
    redirect("/home");
  }

  redirect("/onboarding");
}
