ALTER TABLE "AiModel" ADD COLUMN "supportedParameters" text[] DEFAULT '{}'::text[] NOT NULL;
--> statement-breakpoint
UPDATE "AiModel"
SET "supportedParameters" = CASE
	WHEN "supportsReasoning" THEN ARRAY['reasoning']::text[]
	ELSE '{}'::text[]
END;
