ALTER TABLE "UsageEvent" ADD COLUMN IF NOT EXISTS "timeToFirstTokenMs" integer;
--> statement-breakpoint
ALTER TABLE "UsageEvent" ADD COLUMN IF NOT EXISTS "timeToCompletionMs" integer;
