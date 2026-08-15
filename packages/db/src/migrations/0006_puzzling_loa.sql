ALTER TABLE "marketplace_user_profile" ADD COLUMN "suspended_at" timestamp;--> statement-breakpoint
ALTER TABLE "marketplace_user_profile" ADD COLUMN "suspend_reason" text;
