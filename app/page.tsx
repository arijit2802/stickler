import { auth } from "@/auth";
import { redirect } from "next/navigation";

/** Root page — redirect to onboarding if authenticated, sign-in if not */
export default async function Home() {
  const session = await auth();
  if (session?.user) {
    redirect("/onboarding");
  }
  redirect("/sign-in");
}
