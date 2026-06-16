-- Backfill any remaining NULL usernames with an id-based fallback so the
-- NOT NULL constraint can be applied even where the username backfill script
-- has not been run (the script produces nicer handles; this only guarantees
-- no NULLs). On environments where the backfill ran, these affect 0 rows.
UPDATE "User" SET "username" = 'user_' || replace("id", '-', '') WHERE "username" IS NULL;--> statement-breakpoint
UPDATE "User" SET "displayUsername" = "username" WHERE "displayUsername" IS NULL;--> statement-breakpoint
ALTER TABLE "User" ALTER COLUMN "username" SET NOT NULL;
