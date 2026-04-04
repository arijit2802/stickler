CREATE TABLE "blog_summaries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blog_id" uuid NOT NULL,
	"summary_bullets" jsonb DEFAULT '[]'::jsonb,
	"keywords" jsonb DEFAULT '[]'::jsonb,
	"learning_short" text,
	"audio_url" text,
	"status" text DEFAULT 'none',
	"processed_at" timestamp with time zone,
	CONSTRAINT "blog_summaries_blog_id_unique" UNIQUE("blog_id")
);
--> statement-breakpoint
ALTER TABLE "blog_summaries" ADD CONSTRAINT "blog_summaries_blog_id_blogs_id_fk" FOREIGN KEY ("blog_id") REFERENCES "public"."blogs"("id") ON DELETE no action ON UPDATE no action;