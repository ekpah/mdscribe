ALTER TABLE "User" ADD COLUMN "displayUsername" text;--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "username" text;--> statement-breakpoint
ALTER TABLE "User" ADD CONSTRAINT "User_username_unique" UNIQUE("username");
