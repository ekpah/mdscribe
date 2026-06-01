ALTER TABLE "AiDefaults" ADD COLUMN IF NOT EXISTS "defaultMultimodalModelId" text;
--> statement-breakpoint
ALTER TABLE "AiDefaults" ADD COLUMN IF NOT EXISTS "defaultTextReasoningEffort" text DEFAULT 'none' NOT NULL;
--> statement-breakpoint
ALTER TABLE "AiDefaults" ADD COLUMN IF NOT EXISTS "defaultFileImageReasoningEffort" text DEFAULT 'none' NOT NULL;
--> statement-breakpoint
ALTER TABLE "AiDefaults" ADD COLUMN IF NOT EXISTS "defaultSpeechToTextReasoningEffort" text DEFAULT 'none' NOT NULL;
--> statement-breakpoint
ALTER TABLE "AiDefaults" ADD COLUMN IF NOT EXISTS "defaultEvaluationReasoningEffort" text DEFAULT 'none' NOT NULL;
--> statement-breakpoint
ALTER TABLE "AiDefaults" ADD COLUMN IF NOT EXISTS "defaultMultimodalReasoningEffort" text DEFAULT 'none' NOT NULL;
--> statement-breakpoint
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM pg_constraint
		WHERE conname = 'AiDefaults_defaultMultimodalModelId_AiModel_id_fk'
			AND conrelid = '"AiDefaults"'::regclass
	) THEN
		ALTER TABLE "AiDefaults"
			ADD CONSTRAINT "AiDefaults_defaultMultimodalModelId_AiModel_id_fk"
			FOREIGN KEY ("defaultMultimodalModelId")
			REFERENCES "public"."AiModel"("id")
			ON DELETE set null
			ON UPDATE no action;
	END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "AiScribeFormConfig" DROP CONSTRAINT IF EXISTS "AiScribeFormConfig_modelId_AiModel_id_fk";
--> statement-breakpoint
ALTER TABLE "AiScribeFormConfig" DROP CONSTRAINT IF EXISTS "AiScribeFormConfig_modelId_fkey";
--> statement-breakpoint
ALTER TABLE "AiScribeFormConfig" DROP COLUMN IF EXISTS "modelId";
--> statement-breakpoint
ALTER TABLE "AiModel" DROP COLUMN IF EXISTS "inputModes";
