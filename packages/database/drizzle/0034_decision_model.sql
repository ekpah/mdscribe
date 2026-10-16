ALTER TABLE "AiModel" ADD COLUMN "supportsDecisions" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "AiDefaults" ADD COLUMN "defaultDecisionModelId" text;
--> statement-breakpoint
ALTER TABLE "AiDefaults" ADD CONSTRAINT "AiDefaults_defaultDecisionModelId_AiModel_id_fk" FOREIGN KEY ("defaultDecisionModelId") REFERENCES "public"."AiModel"("id") ON DELETE set null ON UPDATE no action;
