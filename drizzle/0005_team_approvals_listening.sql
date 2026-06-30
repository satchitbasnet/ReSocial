DO $$ BEGIN
  ALTER TYPE "post_status" ADD VALUE IF NOT EXISTS 'pending_approval';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "workflows" ADD COLUMN IF NOT EXISTS "poll_cursor" jsonb;

CREATE TABLE IF NOT EXISTS "tracked_keywords" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "keyword" text NOT NULL,
  "platform" "platform",
  "sentiment" text,
  "mention_count" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
