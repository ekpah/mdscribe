ALTER TABLE "AiConnection" RENAME TO "AiProvider";
--> statement-breakpoint
ALTER TABLE "AiProvider" RENAME COLUMN "apiKeyEncrypted" TO "apiKey";
--> statement-breakpoint
ALTER TABLE "AiProvider" DROP COLUMN "isEnabled";
--> statement-breakpoint
ALTER TABLE "AiProvider" DROP COLUMN "sortOrder";
--> statement-breakpoint
ALTER TABLE "AiModel" RENAME COLUMN "connectionId" TO "providerId";
--> statement-breakpoint
ALTER TABLE "AiModel" ADD COLUMN "supportsReasoning" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "AiModel" ADD COLUMN "inputModes" text[] DEFAULT ARRAY['text']::text[] NOT NULL;
--> statement-breakpoint
UPDATE "AiModel"
SET "supportsReasoning" = "supportsThinking";
--> statement-breakpoint
UPDATE "AiModel"
SET "inputModes" = (
	SELECT ARRAY(
		SELECT DISTINCT mode
		FROM unnest(
			ARRAY['text']::text[]
			|| CASE WHEN "supportsAudio" THEN ARRAY['audio']::text[] ELSE ARRAY[]::text[] END
			|| CASE WHEN "supportsFiles" THEN ARRAY['file', 'image']::text[] ELSE ARRAY[]::text[] END
		) AS mode
	)
);
--> statement-breakpoint
CREATE TABLE "AiDefaults" (
	"id" text PRIMARY KEY NOT NULL,
	"defaultTextModelId" text,
	"defaultFileImageModelId" text,
	"defaultSpeechToTextModelId" text,
	"updatedAt" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "AiDefaults" ADD CONSTRAINT "AiDefaults_defaultTextModelId_AiModel_id_fk" FOREIGN KEY ("defaultTextModelId") REFERENCES "public"."AiModel"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "AiDefaults" ADD CONSTRAINT "AiDefaults_defaultFileImageModelId_AiModel_id_fk" FOREIGN KEY ("defaultFileImageModelId") REFERENCES "public"."AiModel"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "AiDefaults" ADD CONSTRAINT "AiDefaults_defaultSpeechToTextModelId_AiModel_id_fk" FOREIGN KEY ("defaultSpeechToTextModelId") REFERENCES "public"."AiModel"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
INSERT INTO "AiDefaults" (
	"id",
	"defaultTextModelId",
	"defaultFileImageModelId",
	"defaultSpeechToTextModelId",
	"updatedAt"
)
VALUES (
	'global',
	(SELECT "id" FROM "AiModel" WHERE "isDefaultText" = true LIMIT 1),
	(SELECT "id" FROM "AiModel" WHERE "isDefaultMultimodal" = true LIMIT 1),
	(SELECT "id" FROM "AiModel" WHERE "isDefaultSpeechToText" = true LIMIT 1),
	now()
)
ON CONFLICT ("id") DO UPDATE SET
	"defaultTextModelId" = EXCLUDED."defaultTextModelId",
	"defaultFileImageModelId" = EXCLUDED."defaultFileImageModelId",
	"defaultSpeechToTextModelId" = EXCLUDED."defaultSpeechToTextModelId",
	"updatedAt" = now();
--> statement-breakpoint
ALTER TABLE "AiModel" DROP COLUMN "isDefaultText";
--> statement-breakpoint
ALTER TABLE "AiModel" DROP COLUMN "isDefaultMultimodal";
--> statement-breakpoint
ALTER TABLE "AiModel" DROP COLUMN "isDefaultSpeechToText";
--> statement-breakpoint
ALTER TABLE "AiModel" DROP COLUMN "supportsThinking";
--> statement-breakpoint
ALTER TABLE "AiModel" DROP COLUMN "supportsAudio";
--> statement-breakpoint
ALTER TABLE "AiModel" DROP COLUMN "supportsFiles";
--> statement-breakpoint
ALTER TABLE "AiModel" DROP COLUMN "sortOrder";
--> statement-breakpoint
ALTER TABLE "AiModel" DROP COLUMN "isEnabled";
--> statement-breakpoint
DELETE FROM "AiModel" model
USING (
	SELECT ctid,
		ROW_NUMBER() OVER (
			PARTITION BY "providerId", "modelId"
			ORDER BY "id"
		) AS row_num
	FROM "AiModel"
) duplicates
WHERE model.ctid = duplicates.ctid
	AND duplicates.row_num > 1;
--> statement-breakpoint
CREATE UNIQUE INDEX "AiModel_providerId_modelId_key" ON "AiModel" USING btree ("providerId", "modelId");
