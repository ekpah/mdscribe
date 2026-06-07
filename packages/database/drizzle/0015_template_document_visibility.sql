ALTER TABLE "Template" ADD COLUMN "visibility" text DEFAULT 'public' NOT NULL;
--> statement-breakpoint
ALTER TABLE "DocumentTemplate" ADD COLUMN "visibility" text DEFAULT 'public' NOT NULL;
--> statement-breakpoint
CREATE INDEX "Template_visibility_idx" ON "Template" USING btree ("visibility");
--> statement-breakpoint
CREATE INDEX "Template_authorId_visibility_idx" ON "Template" USING btree ("authorId","visibility");
--> statement-breakpoint
CREATE INDEX "DocumentTemplate_visibility_idx" ON "DocumentTemplate" USING btree ("visibility");
--> statement-breakpoint
CREATE INDEX "DocumentTemplate_authorId_visibility_idx" ON "DocumentTemplate" USING btree ("authorId","visibility");
