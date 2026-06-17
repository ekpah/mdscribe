ALTER TABLE "AiDefaults" ADD COLUMN "defaultAgentModelId" text;
--> statement-breakpoint
ALTER TABLE "AiDefaults" ADD COLUMN "defaultAgentReasoningEffort" text DEFAULT 'none' NOT NULL;
--> statement-breakpoint
ALTER TABLE "AiDefaults" ADD COLUMN "defaultAgentTemperature" real;
--> statement-breakpoint
ALTER TABLE "AiDefaults" ADD COLUMN "defaultStandardSupportsAgent" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "AiDefaults" ADD COLUMN "defaultAgentSupportsDocuments" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "AiDefaults" ADD COLUMN "defaultAgentSupportsAudio" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
UPDATE "AiDefaults" SET
	"defaultStandardSupportsAgent" = true
WHERE "defaultTextModelId" IS NOT NULL;
--> statement-breakpoint
ALTER TABLE "AiDefaults" ADD CONSTRAINT "AiDefaults_defaultAgentModelId_AiModel_id_fk" FOREIGN KEY ("defaultAgentModelId") REFERENCES "public"."AiModel"("id") ON DELETE set null ON UPDATE no action;
