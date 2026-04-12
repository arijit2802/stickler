import {
  pgTable,
  uuid,
  text,
  jsonb,
  boolean,
  timestamp,
  integer,
  date,
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

// ─── Blogs ────────────────────────────────────────────────────────────────────

export const blogs = pgTable("blogs", {
  id: uuid("id").primaryKey().defaultRandom(),
  url: text("url").unique().notNull(),
  title: text("title").notNull(),
  source: text("source"), // medium / substack / devto / etc.
  summary: text("summary"),
  author: text("author"),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  estimatedReadMin: integer("estimated_read_min"),
  rawContent: text("raw_content"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ─── Reading Calendar ─────────────────────────────────────────────────────────

export const readingCalendar = pgTable("reading_calendar", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => users.id)
    .notNull(),
  blogId: uuid("blog_id")
    .references(() => blogs.id)
    .notNull(),
  scheduledDate: date("scheduled_date").notNull(),
  status: text("status").default("pending"), // pending | read | skipped
  addedAt: timestamp("added_at", { withTimezone: true }).defaultNow(),
});

// ─── Search Queries (audit / dedup) ───────────────────────────────────────────

export const searchQueries = pgTable("search_queries", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => users.id)
    .notNull(),
  query: text("query"),
  ranAt: timestamp("ran_at", { withTimezone: true }).defaultNow(),
  resultUrls: jsonb("result_urls").$type<string[]>().default([]),
});

// ─── Discovery Suggestions (staging state) ────────────────────────────────────
// Holds pending suggestions until user confirms or rejects them.

export const discoverySuggestions = pgTable("discovery_suggestions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => users.id)
    .notNull(),
  blogId: uuid("blog_id")
    .references(() => blogs.id)
    .notNull(),
  status: text("status").default("pending"), // pending | confirmed | rejected
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ─── Blog Summaries ───────────────────────────────────────────────────────────
// Stores Claude-generated summary, keywords, and learning short script per blog.

export const blogSummaries = pgTable("blog_summaries", {
  id: uuid("id").primaryKey().defaultRandom(),
  blogId: uuid("blog_id")
    .references(() => blogs.id)
    .unique()
    .notNull(),
  // string[] — 3–5 bullet point insights
  summaryBullets: jsonb("summary_bullets").$type<string[]>().default([]),
  // [{ term: string, definition: string }]
  keywords: jsonb("keywords")
    .$type<{ term: string; definition: string }[]>()
    .default([]),
  learningShort: text("learning_short"),
  audioUrl: text("audio_url"),
  // none | generating | done | failed
  audioStatus: text("audio_status").default("none"),
  // Two-voice interview podcast (Jane + Author)
  interviewScript: text("interview_script"),
  interviewAudioUrl: text("interview_audio_url"),
  // none | generating | done | failed
  interviewAudioStatus: text("interview_audio_status").default("none"),
  // none | processing | done | unprocessable
  status: text("status").default("none"),
  processedAt: timestamp("processed_at", { withTimezone: true }),
});

// ─── Type exports ─────────────────────────────────────────────────────────────

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type LearningProfile = typeof learningProfiles.$inferSelect;
export type NewLearningProfile = typeof learningProfiles.$inferInsert;
export type OnboardingSession = typeof onboardingSessions.$inferSelect;
export type NewOnboardingSession = typeof onboardingSessions.$inferInsert;
export type Blog = typeof blogs.$inferSelect;
export type NewBlog = typeof blogs.$inferInsert;
export type ReadingCalendarEntry = typeof readingCalendar.$inferSelect;
export type NewReadingCalendarEntry = typeof readingCalendar.$inferInsert;
export type SearchQuery = typeof searchQueries.$inferSelect;
export type NewSearchQuery = typeof searchQueries.$inferInsert;
export type DiscoverySuggestion = typeof discoverySuggestions.$inferSelect;
export type NewDiscoverySuggestion = typeof discoverySuggestions.$inferInsert;
export type BlogSummary = typeof blogSummaries.$inferSelect;
export type NewBlogSummary = typeof blogSummaries.$inferInsert;
