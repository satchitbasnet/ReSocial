CREATE TYPE "public"."account_type" AS ENUM('creator', 'small_business', 'agency');--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "first_name" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "last_name" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "organization_name" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "account_type" "account_type" DEFAULT 'creator' NOT NULL;
