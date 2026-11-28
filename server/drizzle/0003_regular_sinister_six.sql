CREATE TYPE "public"."video_moderation_status" AS ENUM('AUTO', 'APPROVED', 'HIDDEN');--> statement-breakpoint
CREATE TABLE "game_videos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_key" text NOT NULL,
	"game_id" uuid,
	"youtube_id" varchar(11) NOT NULL,
	"title" text NOT NULL,
	"channel" text NOT NULL,
	"url" text NOT NULL,
	"thumbnail" text NOT NULL,
	"duration" text,
	"language" varchar(10) DEFAULT 'unknown' NOT NULL,
	"moderation_status" "video_moderation_status" DEFAULT 'AUTO' NOT NULL,
	"pinned" boolean DEFAULT false NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "game_videos" ADD CONSTRAINT "game_videos_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "game_videos_game_key_youtube_id_uq" ON "game_videos" USING btree ("game_key","youtube_id");--> statement-breakpoint
CREATE INDEX "game_videos_game_status_idx" ON "game_videos" USING btree ("game_key","moderation_status");