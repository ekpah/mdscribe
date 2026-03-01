/**
 * Schema initialization SQL for Postgres test helpers.
 * This creates all tables matching the application schema.
 */
export const initSchemaSQL = `
	CREATE EXTENSION IF NOT EXISTS vector;

	CREATE TABLE IF NOT EXISTS "User" (
		"id" TEXT PRIMARY KEY,
		"name" TEXT,
		"email" TEXT NOT NULL UNIQUE,
		"emailVerified" BOOLEAN NOT NULL DEFAULT false,
		"image" TEXT,
		"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
		"updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
		"stripeCustomerId" TEXT
	);

	CREATE TABLE IF NOT EXISTS "Account" (
		"id" TEXT PRIMARY KEY,
		"userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
		"accountId" TEXT NOT NULL,
		"providerId" TEXT NOT NULL,
		"accessToken" TEXT,
		"refreshToken" TEXT,
		"accessTokenExpiresAt" TIMESTAMP(3),
		"refreshTokenExpiresAt" TIMESTAMP(3),
		"scope" TEXT,
		"idToken" TEXT,
		"password" TEXT,
		"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
		"updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS "Session" (
		"id" TEXT PRIMARY KEY,
		"userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
		"token" TEXT NOT NULL UNIQUE,
		"expiresAt" TIMESTAMP(3) NOT NULL,
		"ipAddress" TEXT,
		"userAgent" TEXT,
		"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
		"updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS "Verification" (
		"id" TEXT PRIMARY KEY,
		"identifier" TEXT NOT NULL,
		"value" TEXT NOT NULL,
		"expiresAt" TIMESTAMP(3) NOT NULL,
		"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
		"updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS "Template" (
		"id" TEXT PRIMARY KEY,
		"title" TEXT NOT NULL,
		"category" TEXT NOT NULL,
		"content" TEXT NOT NULL,
		"authorId" TEXT NOT NULL REFERENCES "User"("id"),
		"updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
		"embedding" vector(1024)
	);

	CREATE TABLE IF NOT EXISTS "Subscription" (
		"id" TEXT PRIMARY KEY,
		"plan" TEXT NOT NULL,
		"referenceId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
		"stripeCustomerId" TEXT,
		"stripeSubscriptionId" TEXT,
		"status" TEXT NOT NULL,
		"periodStart" TIMESTAMP(3),
		"periodEnd" TIMESTAMP(3),
		"cancelAtPeriodEnd" BOOLEAN,
		"seats" INTEGER,
		"trialStart" TIMESTAMP(3),
		"trialEnd" TIMESTAMP(3),
		"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
		"updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS "UsageEvent" (
		"id" TEXT PRIMARY KEY,
		"userId" TEXT NOT NULL REFERENCES "User"("id"),
		"timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
		"name" TEXT NOT NULL,
		"inputTokens" INTEGER,
		"outputTokens" INTEGER,
		"totalTokens" INTEGER,
		"reasoningTokens" INTEGER,
		"cachedTokens" INTEGER,
		"cost" NUMERIC(10, 6),
		"model" TEXT,
		"inputData" JSONB,
		"metadata" JSONB,
		"result" TEXT,
		"reasoning" TEXT
	);

	CREATE INDEX IF NOT EXISTS "UsageEvent_userId_timestamp_idx" ON "UsageEvent"("userId", "timestamp");
	CREATE INDEX IF NOT EXISTS "UsageEvent_name_timestamp_idx" ON "UsageEvent"("name", "timestamp");

	CREATE TABLE IF NOT EXISTS "TextSnippet" (
		"id" TEXT PRIMARY KEY,
		"userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
		"key" TEXT NOT NULL,
		"snippet" TEXT NOT NULL,
		"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
		"updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
	);

	CREATE UNIQUE INDEX IF NOT EXISTS "TextSnippet_userId_key_key" ON "TextSnippet"("userId", "key");

	CREATE TABLE IF NOT EXISTS "_favourites" (
		"A" TEXT NOT NULL REFERENCES "Template"("id") ON DELETE CASCADE,
		"B" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
		PRIMARY KEY ("A", "B")
	);

	CREATE INDEX IF NOT EXISTS "_favourites_B_index" ON "_favourites"("B");

	DO $$
	BEGIN
		IF to_regclass('"AiConnection"') IS NOT NULL
			AND to_regclass('"AiProvider"') IS NULL THEN
			ALTER TABLE "AiConnection" RENAME TO "AiProvider";
		END IF;
	END $$;

	CREATE TABLE IF NOT EXISTS "AiProvider" (
		"id" TEXT PRIMARY KEY,
		"name" TEXT NOT NULL,
		"protocol" TEXT NOT NULL,
		"baseUrl" TEXT,
		"apiKey" TEXT
	);

	ALTER TABLE "AiProvider" ADD COLUMN IF NOT EXISTS "apiKey" TEXT;
	ALTER TABLE "AiProvider" DROP COLUMN IF EXISTS "isEnabled";
	ALTER TABLE "AiProvider" DROP COLUMN IF EXISTS "sortOrder";

	DO $$
	BEGIN
		IF EXISTS (
			SELECT 1
			FROM information_schema.columns
			WHERE table_schema = 'public'
				AND table_name = 'AiProvider'
				AND column_name = 'apiKeyEncrypted'
		) THEN
			EXECUTE 'UPDATE "AiProvider" SET "apiKey" = COALESCE("apiKey", "apiKeyEncrypted")';
			EXECUTE 'ALTER TABLE "AiProvider" DROP COLUMN IF EXISTS "apiKeyEncrypted"';
		END IF;
	END $$;

	CREATE TABLE IF NOT EXISTS "AiModel" (
		"id" TEXT PRIMARY KEY,
		"providerId" TEXT NOT NULL REFERENCES "AiProvider"("id") ON DELETE CASCADE,
		"modelId" TEXT NOT NULL,
		"displayName" TEXT NOT NULL,
		"supportsReasoning" BOOLEAN NOT NULL DEFAULT false,
		"inputModes" TEXT[] NOT NULL DEFAULT ARRAY['text']
	);

	DO $$
	BEGIN
		IF EXISTS (
			SELECT 1
			FROM information_schema.columns
			WHERE table_schema = 'public'
				AND table_name = 'AiModel'
				AND column_name = 'connectionId'
		)
		AND NOT EXISTS (
			SELECT 1
			FROM information_schema.columns
			WHERE table_schema = 'public'
				AND table_name = 'AiModel'
				AND column_name = 'providerId'
		) THEN
			ALTER TABLE "AiModel" RENAME COLUMN "connectionId" TO "providerId";
		END IF;
	END $$;

	ALTER TABLE "AiModel" ADD COLUMN IF NOT EXISTS "providerId" TEXT;
	ALTER TABLE "AiModel" ADD COLUMN IF NOT EXISTS "supportsReasoning" BOOLEAN NOT NULL DEFAULT false;
	ALTER TABLE "AiModel" ADD COLUMN IF NOT EXISTS "inputModes" TEXT[] NOT NULL DEFAULT ARRAY['text'];

	DO $$
	BEGIN
		IF EXISTS (
			SELECT 1
			FROM information_schema.columns
			WHERE table_schema = 'public'
				AND table_name = 'AiModel'
				AND column_name = 'supportsThinking'
		) THEN
			EXECUTE 'UPDATE "AiModel" SET "supportsReasoning" = "supportsThinking"';
		END IF;
	END $$;

	DO $$
	BEGIN
		IF EXISTS (
			SELECT 1
			FROM information_schema.columns
			WHERE table_schema = 'public'
				AND table_name = 'AiModel'
				AND column_name = 'supportsAudio'
		)
		OR EXISTS (
			SELECT 1
			FROM information_schema.columns
			WHERE table_schema = 'public'
				AND table_name = 'AiModel'
				AND column_name = 'supportsFiles'
		) THEN
			EXECUTE 'UPDATE "AiModel"
				SET "inputModes" = (
					SELECT ARRAY(
						SELECT DISTINCT mode
						FROM unnest(
							ARRAY[''text'']::text[]
							|| CASE WHEN COALESCE("supportsAudio", false) THEN ARRAY[''audio'']::text[] ELSE ARRAY[]::text[] END
							|| CASE WHEN COALESCE("supportsFiles", false) THEN ARRAY[''file'', ''image'']::text[] ELSE ARRAY[]::text[] END
						) AS mode
					)
				)';
		END IF;
	END $$;

	CREATE TABLE IF NOT EXISTS "AiDefaults" (
		"id" TEXT PRIMARY KEY,
		"defaultTextModelId" TEXT REFERENCES "AiModel"("id") ON DELETE SET NULL,
		"defaultFileImageModelId" TEXT REFERENCES "AiModel"("id") ON DELETE SET NULL,
		"defaultSpeechToTextModelId" TEXT REFERENCES "AiModel"("id") ON DELETE SET NULL,
		"updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
	);

	DO $$
	BEGIN
		IF NOT EXISTS (SELECT 1 FROM "AiDefaults" WHERE "id" = 'global') THEN
			INSERT INTO "AiDefaults" (
				"id",
				"defaultTextModelId",
				"defaultFileImageModelId",
				"defaultSpeechToTextModelId",
				"updatedAt"
			)
			VALUES ('global', NULL, NULL, NULL, CURRENT_TIMESTAMP);
		END IF;
	END $$;

	ALTER TABLE "AiModel" DROP COLUMN IF EXISTS "isDefaultText";
	ALTER TABLE "AiModel" DROP COLUMN IF EXISTS "isDefaultMultimodal";
	ALTER TABLE "AiModel" DROP COLUMN IF EXISTS "isDefaultSpeechToText";
	ALTER TABLE "AiModel" DROP COLUMN IF EXISTS "supportsThinking";
	ALTER TABLE "AiModel" DROP COLUMN IF EXISTS "supportsAudio";
	ALTER TABLE "AiModel" DROP COLUMN IF EXISTS "supportsFiles";
	ALTER TABLE "AiModel" DROP COLUMN IF EXISTS "sortOrder";
	ALTER TABLE "AiModel" DROP COLUMN IF EXISTS "isEnabled";

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

	CREATE UNIQUE INDEX IF NOT EXISTS "AiModel_providerId_modelId_key"
		ON "AiModel"("providerId", "modelId");
	`;
