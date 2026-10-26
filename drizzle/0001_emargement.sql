CREATE TYPE "public"."outcome" AS ENUM('passed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."presence" AS ENUM('present', 'absent');--> statement-breakpoint
CREATE TABLE "attendance" (
	"session_id" text NOT NULL,
	"slot_start" timestamp with time zone NOT NULL,
	"trainee_id" text NOT NULL,
	"presence" "presence" NOT NULL,
	"signature" text,
	"recorded_by" text,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "attendance_session_id_slot_start_trainee_id_pk" PRIMARY KEY("session_id","slot_start","trainee_id")
);
--> statement-breakpoint
CREATE TABLE "organization" (
	"id" text PRIMARY KEY DEFAULT 'main' NOT NULL,
	"name" text NOT NULL,
	"address" text,
	"siret" text,
	"nda" text,
	"phone" text,
	"email" text,
	"signatory" text
);
--> statement-breakpoint
CREATE TABLE "test_results" (
	"session_id" text NOT NULL,
	"trainee_id" text NOT NULL,
	"theory" "outcome",
	"theory_score" integer,
	"practice" "outcome",
	"categories" text,
	"comment" text,
	"tester_id" text,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "test_results_session_id_trainee_id_pk" PRIMARY KEY("session_id","trainee_id")
);
--> statement-breakpoint
CREATE TABLE "trainer_signatures" (
	"session_id" text NOT NULL,
	"slot_start" timestamp with time zone NOT NULL,
	"trainer_id" text NOT NULL,
	"signature" text NOT NULL,
	"signed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trainer_signatures_session_id_slot_start_trainer_id_pk" PRIMARY KEY("session_id","slot_start","trainer_id")
);
--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_trainee_id_trainees_id_fk" FOREIGN KEY ("trainee_id") REFERENCES "public"."trainees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_recorded_by_trainers_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."trainers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_results" ADD CONSTRAINT "test_results_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_results" ADD CONSTRAINT "test_results_trainee_id_trainees_id_fk" FOREIGN KEY ("trainee_id") REFERENCES "public"."trainees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_results" ADD CONSTRAINT "test_results_tester_id_trainers_id_fk" FOREIGN KEY ("tester_id") REFERENCES "public"."trainers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trainer_signatures" ADD CONSTRAINT "trainer_signatures_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trainer_signatures" ADD CONSTRAINT "trainer_signatures_trainer_id_trainers_id_fk" FOREIGN KEY ("trainer_id") REFERENCES "public"."trainers"("id") ON DELETE cascade ON UPDATE no action;