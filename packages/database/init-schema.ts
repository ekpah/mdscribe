/**
 * Schema initialization SQL for PGlite
 * This creates all tables matching the production PostgreSQL schema
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

	CREATE TABLE IF NOT EXISTS "TemplateCollection" (
		"id" TEXT PRIMARY KEY,
		"userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
		"name" TEXT NOT NULL,
		"description" TEXT,
		"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
		"updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
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

	CREATE TABLE IF NOT EXISTS "TemplateCollectionTemplate" (
		"collectionId" TEXT NOT NULL REFERENCES "TemplateCollection"("id") ON DELETE CASCADE,
		"templateId" TEXT NOT NULL REFERENCES "Template"("id") ON DELETE CASCADE,
		PRIMARY KEY ("collectionId", "templateId")
	);

	CREATE INDEX IF NOT EXISTS "TemplateCollectionTemplate_templateId_idx" ON "TemplateCollectionTemplate"("templateId");
`;
