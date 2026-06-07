ALTER TABLE "AiScribeFormConfig" ADD COLUMN IF NOT EXISTS "authorId" text;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "AiScribeFormConfig" ADD CONSTRAINT "AiScribeFormConfig_authorId_User_id_fk" FOREIGN KEY ("authorId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "AiScribeFormConfig_authorId_idx" ON "AiScribeFormConfig" USING btree ("authorId");
