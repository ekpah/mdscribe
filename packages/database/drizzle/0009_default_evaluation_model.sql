ALTER TABLE "AiDefaults" ADD COLUMN "defaultEvaluationModel" text;
--> statement-breakpoint
ALTER TABLE "AiDefaults" ADD CONSTRAINT "AiDefaults_defaultEvaluationModel_AiModel_id_fk" FOREIGN KEY ("defaultEvaluationModel") REFERENCES "public"."AiModel"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
UPDATE "AiDefaults"
SET "defaultEvaluationModel" = "defaultTextModelId"
WHERE "defaultEvaluationModel" IS NULL;
