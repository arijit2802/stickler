ALTER TABLE "blog_summaries" ADD COLUMN "interview_script" text;--> statement-breakpoint
ALTER TABLE "blog_summaries" ADD COLUMN "interview_audio_url" text;--> statement-breakpoint
ALTER TABLE "blog_summaries" ADD COLUMN "interview_audio_status" text DEFAULT 'none';