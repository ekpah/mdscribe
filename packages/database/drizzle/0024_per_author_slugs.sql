DROP INDEX "AiScribeFormConfig_slug_key";--> statement-breakpoint
DROP INDEX "AiScribeWorkspace_slug_key";--> statement-breakpoint
CREATE UNIQUE INDEX "AiScribeFormConfig_global_slug_key" ON "AiScribeFormConfig" USING btree ("slug") WHERE "AiScribeFormConfig"."authorId" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "AiScribeFormConfig_author_slug_key" ON "AiScribeFormConfig" USING btree ("authorId","slug") WHERE "AiScribeFormConfig"."authorId" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "AiScribeWorkspace_global_slug_key" ON "AiScribeWorkspace" USING btree ("slug") WHERE "AiScribeWorkspace"."authorId" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "AiScribeWorkspace_author_slug_key" ON "AiScribeWorkspace" USING btree ("authorId","slug") WHERE "AiScribeWorkspace"."authorId" is not null;
