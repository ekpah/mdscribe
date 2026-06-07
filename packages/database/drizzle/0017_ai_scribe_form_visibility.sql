ALTER TABLE "AiScribeFormConfig" ADD COLUMN IF NOT EXISTS "visibility" text DEFAULT 'public' NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "AiScribeFormConfig_visibility_idx" ON "AiScribeFormConfig" USING btree ("visibility");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "AiScribeFormConfig_authorId_visibility_idx" ON "AiScribeFormConfig" USING btree ("authorId","visibility");
