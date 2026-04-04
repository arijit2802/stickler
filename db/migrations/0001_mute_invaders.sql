CREATE TABLE "blogs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"url" text NOT NULL,
	"title" text NOT NULL,
	"source" text,
	"summary" text,
	"author" text,
	"published_at" timestamp with time zone,
	"estimated_read_min" integer,
	"raw_content" text,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "blogs_url_unique" UNIQUE("url")
);
--> statement-breakpoint
CREATE TABLE "discovery_suggestions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"blog_id" uuid NOT NULL,
	"status" text DEFAULT 'pending',
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "reading_calendar" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"blog_id" uuid NOT NULL,
	"scheduled_date" date NOT NULL,
	"status" text DEFAULT 'pending',
	"added_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "search_queries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"query" text,
	"ran_at" timestamp with time zone DEFAULT now(),
	"result_urls" jsonb DEFAULT '[]'::jsonb
);
--> statement-breakpoint
ALTER TABLE "discovery_suggestions" ADD CONSTRAINT "discovery_suggestions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discovery_suggestions" ADD CONSTRAINT "discovery_suggestions_blog_id_blogs_id_fk" FOREIGN KEY ("blog_id") REFERENCES "public"."blogs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reading_calendar" ADD CONSTRAINT "reading_calendar_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reading_calendar" ADD CONSTRAINT "reading_calendar_blog_id_blogs_id_fk" FOREIGN KEY ("blog_id") REFERENCES "public"."blogs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_queries" ADD CONSTRAINT "search_queries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;