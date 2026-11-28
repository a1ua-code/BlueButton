CREATE TYPE "public"."attendance_incident" AS ENUM('NO_SHOW', 'LATE_CANCEL');--> statement-breakpoint
CREATE TABLE "attendance_incidents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"party_id" uuid,
	"party_title" text NOT NULL,
	"party_start_at" timestamp with time zone NOT NULL,
	"type" "attendance_incident" NOT NULL,
	"points_half_units" integer NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"applied_suspension_id" uuid,
	"revoked_at" timestamp with time zone,
	"revoked_by_id" uuid,
	"review_reason" text
);
--> statement-breakpoint
CREATE TABLE "attendance_suspensions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"level" integer NOT NULL,
	"duration_days" integer NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	"revoked_by_id" uuid
);
--> statement-breakpoint
ALTER TABLE "party_members" ADD COLUMN "no_show" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "attendance_incidents" ADD CONSTRAINT "attendance_incidents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_incidents" ADD CONSTRAINT "attendance_incidents_party_id_parties_id_fk" FOREIGN KEY ("party_id") REFERENCES "public"."parties"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_incidents" ADD CONSTRAINT "attendance_incidents_applied_suspension_id_attendance_suspensions_id_fk" FOREIGN KEY ("applied_suspension_id") REFERENCES "public"."attendance_suspensions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_incidents" ADD CONSTRAINT "attendance_incidents_revoked_by_id_users_id_fk" FOREIGN KEY ("revoked_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_suspensions" ADD CONSTRAINT "attendance_suspensions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_suspensions" ADD CONSTRAINT "attendance_suspensions_revoked_by_id_users_id_fk" FOREIGN KEY ("revoked_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "attendance_one_incident_type_per_party" ON "attendance_incidents" USING btree ("user_id","party_id","type");--> statement-breakpoint
CREATE INDEX "attendance_user_occurred_idx" ON "attendance_incidents" USING btree ("user_id","occurred_at");--> statement-breakpoint
CREATE INDEX "attendance_ban_user_start_idx" ON "attendance_suspensions" USING btree ("user_id","starts_at");