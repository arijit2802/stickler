import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  onboardingSessions,
  learningProfiles,
  type OnboardingSession,
  type LearningProfile,
} from "@/db/schema";
import type { LearningProfileData, ConversationMessage } from "@/src/types/onboarding";

// ─── Session ──────────────────────────────────────────────────────────────────

/**
 * Create a new onboarding session for the given user.
 */
export async function createSession(userId: string): Promise<OnboardingSession> {
  const result = await db
    .insert(onboardingSessions)
    .values({ userId, messages: [], answers: {}, clarificationCount: {} })
    .returning();
  return result[0];
}

/**
 * Load session by ID. Returns null if not found.
 */
export async function getSession(sessionId: string): Promise<OnboardingSession | null> {
  const result = await db
    .select()
    .from(onboardingSessions)
    .where(eq(onboardingSessions.id, sessionId))
    .limit(1);
  return result[0] ?? null;
}

/**
 * Load the most recent incomplete session for a user (for resume on re-login).
 */
export async function getActiveSession(userId: string): Promise<OnboardingSession | null> {
  const result = await db
    .select()
    .from(onboardingSessions)
    .where(eq(onboardingSessions.userId, userId))
    .limit(1);
  // Return only if not complete
  const session = result[0] ?? null;
  if (session && session.isComplete) return null;
  return session;
}

/**
 * Persist updated session state after each turn.
 */
export async function updateSession(
  sessionId: string,
  patch: {
    step?: number;
    answers?: Record<string, string>;
    clarificationCount?: Record<string, number>;
    messages?: ConversationMessage[];
    isComplete?: boolean;
  }
): Promise<OnboardingSession> {
  const result = await db
    .update(onboardingSessions)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(onboardingSessions.id, sessionId))
    .returning();
  return result[0];
}

/**
 * Delete a session (used when user wants to restart the interview).
 */
export async function deleteSession(sessionId: string): Promise<void> {
  await db.delete(onboardingSessions).where(eq(onboardingSessions.id, sessionId));
}

// ─── Learning Profile ─────────────────────────────────────────────────────────

/**
 * Save or update the confirmed learning profile for a user.
 * Uses upsert — only one profile per user.
 */
export async function saveProfile(
  userId: string,
  data: LearningProfileData
): Promise<LearningProfile> {
  const existing = await getProfile(userId);
  if (existing) {
    const result = await db
      .update(learningProfiles)
      .set({ ...data, isConfirmed: true, updatedAt: new Date() })
      .where(eq(learningProfiles.userId, userId))
      .returning();
    return result[0];
  }

  const result = await db
    .insert(learningProfiles)
    .values({ userId, ...data, isConfirmed: true })
    .returning();
  return result[0];
}

/**
 * Fetch the learning profile for a user. Returns null if not found.
 */
export async function getProfile(userId: string): Promise<LearningProfile | null> {
  const result = await db
    .select()
    .from(learningProfiles)
    .where(eq(learningProfiles.userId, userId))
    .limit(1);
  return result[0] ?? null;
}

/**
 * Partially update specific fields of a user's learning profile.
 */
export async function updateProfile(
  userId: string,
  patch: Partial<LearningProfileData>
): Promise<LearningProfile | null> {
  const result = await db
    .update(learningProfiles)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(learningProfiles.userId, userId))
    .returning();
  return result[0] ?? null;
}
