DO $$ BEGIN
  CREATE TYPE "workflow_type" AS ENUM('new_content', 'existing_content');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "content_type" AS ENUM('video', 'photos');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "workflows" ADD COLUMN IF NOT EXISTS "workflow_type" "workflow_type" DEFAULT 'new_content' NOT NULL;
ALTER TABLE "workflows" ADD COLUMN IF NOT EXISTS "content_type" "content_type" DEFAULT 'video' NOT NULL;
ALTER TABLE "workflows" ADD COLUMN IF NOT EXISTS "source_account_id" uuid REFERENCES "connected_accounts"("id") ON DELETE SET NULL;
ALTER TABLE "workflows" ADD COLUMN IF NOT EXISTS "last_polled_at" timestamp;
