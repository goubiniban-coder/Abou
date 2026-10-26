CREATE TYPE "public"."proposal_status" AS ENUM('open', 'accepted', 'declined');--> statement-breakpoint
CREATE TABLE "proposals" (
	"id" text PRIMARY KEY NOT NULL,
	"token" text NOT NULL,
	"number" text NOT NULL,
	"client_id" text,
	"course_id" text NOT NULL,
	"site_id" text NOT NULL,
	"trainee_ids" jsonb NOT NULL,
	"options" jsonb NOT NULL,
	"price_per_trainee" integer,
	"status" "proposal_status" DEFAULT 'open' NOT NULL,
	"chosen_option" integer,
	"session_id" text,
	"accepted_by" text,
	"accepted_at" timestamp with time zone,
	"expires_on" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "proposals_token_unique" UNIQUE("token"),
	CONSTRAINT "proposals_number_unique" UNIQUE("number")
);
--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "price_per_trainee" integer;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "vat_rate" integer DEFAULT 20 NOT NULL;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE set null ON UPDATE no action;