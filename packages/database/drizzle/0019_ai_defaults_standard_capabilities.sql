ALTER TABLE "AiDefaults" ADD COLUMN "defaultStandardSupportsDocuments" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "AiDefaults" ADD COLUMN "defaultStandardSupportsAudio" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "AiDefaults" ADD COLUMN "defaultFileImageMode" text DEFAULT 'multimodal' NOT NULL;
--> statement-breakpoint
ALTER TABLE "AiDefaults" ADD COLUMN "defaultSpeechToTextMode" text DEFAULT 'direct' NOT NULL;
--> statement-breakpoint
UPDATE "AiDefaults" SET
	"defaultTextModelId" = COALESCE("defaultMultimodalModelId", "defaultTextModelId"),
	"defaultTextReasoningEffort" = CASE WHEN "defaultMultimodalModelId" IS NOT NULL THEN "defaultMultimodalReasoningEffort" ELSE "defaultTextReasoningEffort" END,
	"defaultStandardSupportsDocuments" = ("defaultMultimodalModelId" IS NOT NULL),
	"defaultStandardSupportsAudio" = ("defaultMultimodalModelId" IS NOT NULL);
--> statement-breakpoint
ALTER TABLE "AiDefaults" DROP COLUMN "defaultMultimodalModelId";
--> statement-breakpoint
ALTER TABLE "AiDefaults" DROP COLUMN "defaultMultimodalReasoningEffort";
