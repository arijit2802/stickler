import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { findUserByEmail } from "@/src/models/users";
import { logger } from "@/src/utils/logger";
import type { User } from "@/db/schema";

/**
 * Resolve the authenticated session to a DB User record.
 * Returns null if unauthenticated or user not found.
 */
export async function resolveDbUser(): Promise<User | null> {
  const session = await auth();
  if (!session?.user?.email) return null;
  return findUserByEmail(session.user.email);
}

/**
 * Standard error response builder.
 */
export function errorResponse(message: string, status = 400): NextResponse {
  logger.warn({ message, status }, "API error response");
  return NextResponse.json({ error: message }, { status });
}

/**
 * Sanitise a free-text string to prevent XSS / injection.
 * Strips HTML tags and trims whitespace.
 */
export function sanitise(input: string): string {
  return input.replace(/<[^>]*>/g, "").trim();
}
