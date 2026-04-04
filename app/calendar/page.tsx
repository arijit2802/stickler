import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { resolveDbUser } from "@/src/utils/api-helpers";
import { getWeek } from "@/src/services/calendar";
import { ReadingCalendar } from "@/src/components/ReadingCalendar";

/**
 * Calendar page — server component.
 * Fetches the current week's reading schedule and renders the calendar.
 */
export default async function CalendarPage() {
  const session = await auth();
  if (!session) redirect("/sign-in");

  const user = await resolveDbUser();
  if (!user) redirect("/sign-in");

  const data = await getWeek(user.id);

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Reading Calendar</h1>
        <a
          href="/discovery"
          className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
        >
          + Discover blogs
        </a>
      </div>
      <ReadingCalendar initial={data} />
    </main>
  );
}
