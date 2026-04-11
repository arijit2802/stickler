import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { resolveDbUser } from "@/src/utils/api-helpers";
import { getCurrentSuggestions, runDiscovery } from "@/src/services/blog-discovery";
import { DiscoveryPageClient } from "./DiscoveryPageClient";

/**
 * Discovery page — server component.
 * Loads (or triggers) suggestions, then hands off to the client shell.
 */
export default async function DiscoveryPage() {
  const session = await auth();
  if (!session) redirect("/sign-in");

  const user = await resolveDbUser();
  if (!user) redirect("/sign-in");

  // Try to load existing pending suggestions; run discovery if none
  let suggestions = await getCurrentSuggestions(user.id);
  if (suggestions.length === 0) {
    try {
      suggestions = await runDiscovery(user.id);
    } catch {
      // DiscoveryPageClient handles empty state gracefully
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Blog Discovery</h1>
      <DiscoveryPageClient initial={suggestions} />
    </main>
  );
}
