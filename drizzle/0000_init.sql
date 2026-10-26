CREATE TYPE "public"."assignment_role" AS ENUM('theory', 'practice', 'tester');--> statement-breakpoint
CREATE TYPE "public"."resource_type" AS ENUM('trainer', 'room', 'equipment');--> statement-breakpoint
CREATE TYPE "public"."session_mode" AS ENUM('inter', 'intra');--> statement-breakpoint
CREATE TYPE "public"."session_status" AS ENUM('draft', 'confirmed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."slot_kind" AS ENUM('theory', 'practice', 'test');--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"hash" text NOT NULL,
	"prefix" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone,
	CONSTRAINT "api_keys_hash_unique" UNIQUE("hash")
);
--> statement-breakpoint
CREATE TABLE "assignments" (
	"session_id" text NOT NULL,
	"trainer_id" text NOT NULL,
	"role" "assignment_role" NOT NULL,
	CONSTRAINT "assignments_session_id_trainer_id_role_pk" PRIMARY KEY("session_id","trainer_id","role")
);
--> statement-breakpoint
CREATE TABLE "certifications" (
	"id" text PRIMARY KEY NOT NULL,
	"trainee_id" text NOT NULL,
	"course_id" text NOT NULL,
	"session_id" text,
	"obtained_on" date NOT NULL,
	"valid_until" date NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"city" text
);
--> statement-breakpoint
CREATE TABLE "courses" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"title" text NOT NULL,
	"duration_half_days" integer NOT NULL,
	"max_trainees" integer NOT NULL,
	"required_competences" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"required_equipment_kinds" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"test_units_per_trainee" integer,
	"validity_months" integer,
	"color" text
);
--> statement-breakpoint
CREATE TABLE "enrollments" (
	"session_id" text NOT NULL,
	"trainee_id" text NOT NULL,
	CONSTRAINT "enrollments_session_id_trainee_id_pk" PRIMARY KEY("session_id","trainee_id")
);
--> statement-breakpoint
CREATE TABLE "equipment" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"site_id" text
);
--> statement-breakpoint
CREATE TABLE "rooms" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"site_id" text NOT NULL,
	"capacity" integer NOT NULL,
	"equipment" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session_equipment" (
	"session_id" text NOT NULL,
	"equipment_id" text NOT NULL,
	CONSTRAINT "session_equipment_session_id_equipment_id_pk" PRIMARY KEY("session_id","equipment_id")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"course_id" text NOT NULL,
	"site_id" text NOT NULL,
	"mode" "session_mode" DEFAULT 'inter' NOT NULL,
	"client_id" text,
	"room_id" text,
	"status" "session_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sites" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"city" text
);
--> statement-breakpoint
CREATE TABLE "slots" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"start" timestamp with time zone NOT NULL,
	"end" timestamp with time zone NOT NULL,
	"kind" "slot_kind" DEFAULT 'theory' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trainees" (
	"id" text PRIMARY KEY NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email" text,
	"client_id" text
);
--> statement-breakpoint
CREATE TABLE "trainers" (
	"id" text PRIMARY KEY NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email" text,
	"external" boolean DEFAULT false NOT NULL,
	"site_id" text,
	"competences" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"test_units_per_day" integer,
	"calendar_token" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "unavailabilities" (
	"id" text PRIMARY KEY NOT NULL,
	"resource_type" "resource_type" NOT NULL,
	"resource_id" text NOT NULL,
	"start" timestamp with time zone NOT NULL,
	"end" timestamp with time zone NOT NULL,
	"reason" text
);
--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_trainer_id_trainers_id_fk" FOREIGN KEY ("trainer_id") REFERENCES "public"."trainers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certifications" ADD CONSTRAINT "certifications_trainee_id_trainees_id_fk" FOREIGN KEY ("trainee_id") REFERENCES "public"."trainees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certifications" ADD CONSTRAINT "certifications_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certifications" ADD CONSTRAINT "certifications_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_trainee_id_trainees_id_fk" FOREIGN KEY ("trainee_id") REFERENCES "public"."trainees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipment" ADD CONSTRAINT "equipment_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_equipment" ADD CONSTRAINT "session_equipment_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_equipment" ADD CONSTRAINT "session_equipment_equipment_id_equipment_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slots" ADD CONSTRAINT "slots_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trainees" ADD CONSTRAINT "trainees_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trainers" ADD CONSTRAINT "trainers_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "slots_session_idx" ON "slots" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "slots_start_idx" ON "slots" USING btree ("start");