import {
  pgTable,
  uuid,
  text,
  jsonb,
  boolean,
  timestamp,
  integer,
} from "drizzle-orm/pg-core";

// ─── Users ────────────────────────────────────────────────────────────────────

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").unique().notNull(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ─── Learning Profiles ────────────────────────────────────────────────────────

export const learningProfiles = pgTable("learning_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => users.id)
    .notNull(),
  role: text("role"),
  // [{ topic: string, depth: string, keywords: string[] }]
  interests: jsonb("interests").$type<
    { topic: string; depth: string; keywords: string[] }[]
  >(),
  // [{ goal: string, priority: number }]
  aspirations: jsonb("aspirations").$type<
    { goal: string; priority: number }[]
  >(),
  // [{ topic: string, level: 'beginner' | 'intermediate' | 'advanced' }]
  knowledgeLevel: jsonb("knowledge_level").$type<
    { topic: string; level: "beginner" | "intermediate" | "advanced" }[]
  >(),
  motivation: text("motivation"),
  isConfirmed: boolean("is_confirmed").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// ─── Onboarding Sessions ──────────────────────────────────────────────────────
// Stores conversation state between turns (replaces Redis for MVP)

export const onboardingSessions = pgTable("onboarding_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => users.id)
    .notNull(),
  step: integer("step").default(0).notNull(),
  // Record<string, string> — answers keyed by step name
  answers: jsonb("answers").$type<Record<string, string>>().default({}),
  // Record<string, number> — clarification count per step
  clarificationCount: jsonb("clarification_count")
    .$type<Record<string, number>>()
    .default({}),
  // Anthropic message history: { role: 'user'|'assistant', content: string }[]
  messages: jsonb("messages")
    .$type<{ role: "user" | "assistant"; content: string }[]>()
    .default([]),
  isComplete: boolean("is_complete").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// ─── Type exports ─────────────────────────────────────────────────────────────

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type LearningProfile = typeof learningProfiles.$inferSelect;
export type NewLearningProfile = typeof learningProfiles.$inferInsert;
export type OnboardingSession = typeof onboardingSessions.$inferSelect;
export type NewOnboardingSession = typeof onboardingSessions.$inferInsert;
