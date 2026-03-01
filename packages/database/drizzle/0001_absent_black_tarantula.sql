ALTER TABLE "AiModel" ADD COLUMN "isDefaultText" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "AiModel" ADD COLUMN "isDefaultMultimodal" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "AiModel" ADD COLUMN "isDefaultSpeechToText" boolean DEFAULT false NOT NULL;