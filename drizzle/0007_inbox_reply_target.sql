ALTER TABLE "inbox_messages" ADD COLUMN IF NOT EXISTS "reply_target_id" text;
