UPDATE "UsageEvent"
SET "metadata" = "metadata" - 'usageEvaluation'
WHERE "metadata" ? 'usageEvaluation';--> statement-breakpoint
ALTER TABLE "AiDefaults" DROP COLUMN IF EXISTS "defaultEvaluationModel";--> statement-breakpoint
ALTER TABLE "AiDefaults" DROP COLUMN IF EXISTS "defaultEvaluationReasoningEffort";--> statement-breakpoint
ALTER TABLE "AiDefaults" DROP COLUMN IF EXISTS "defaultEvaluationTemperature";
