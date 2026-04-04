"use client";

import { useRouter } from "next/navigation";
import { DiscoverySuggestions } from "@/src/components/DiscoverySuggestions";
import type { SuggestionItem } from "@/src/types/discovery";

interface Props {
  initial: SuggestionItem[];
}

/**
 * Thin client wrapper: provides router navigation after suggestions are confirmed.
 */
export function DiscoveryPageClient({ initial }: Props) {
  const router = useRouter();

  return (
    <DiscoverySuggestions
      initial={initial}
      onConfirmed={() => router.push("/calendar")}
    />
  );
}
