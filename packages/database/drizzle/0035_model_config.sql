ALTER TABLE "AiProvider" ADD COLUMN "options" jsonb DEFAULT '{}'::jsonb NOT NULL;
--> statement-breakpoint
ALTER TABLE "AiModel" ADD COLUMN "kind" text DEFAULT 'chat' NOT NULL;
--> statement-breakpoint
ALTER TABLE "AiModel" ADD COLUMN "input" text[] DEFAULT '{text}' NOT NULL;
--> statement-breakpoint
ALTER TABLE "AiModel" ADD COLUMN "contextWindow" integer;
--> statement-breakpoint
ALTER TABLE "AiModel" ADD COLUMN "maxOutputTokens" integer;
--> statement-breakpoint
ALTER TABLE "AiModel" ADD COLUMN "cost" jsonb;
--> statement-breakpoint
ALTER TABLE "AiModel" ADD COLUMN "options" jsonb DEFAULT '{}'::jsonb NOT NULL;
--> statement-breakpoint
UPDATE "AiModel" SET "kind" = 'decision' WHERE "supportsDecisions";
--> statement-breakpoint
UPDATE "AiModel" SET "kind" = 'ocr', "input" = '{image,document}'
FROM "AiProvider"
WHERE "AiModel"."providerId" = "AiProvider"."id"
	AND "AiProvider"."protocol" IN ('ocr-http', 'mistral-ocr', 'privatemode-ocr');
--> statement-breakpoint
UPDATE "AiModel" SET "options" = jsonb_build_object('openRouterRoutingMode', "openRouterRoutingMode")
WHERE "openRouterRoutingMode" <> 'default';
--> statement-breakpoint
ALTER TABLE "AiModel" DROP COLUMN "supportsDecisions";
--> statement-breakpoint
ALTER TABLE "AiModel" DROP COLUMN "openRouterRoutingMode";
--> statement-breakpoint
DROP INDEX "AiModel_providerId_modelId_key";
--> statement-breakpoint
CREATE UNIQUE INDEX "AiModel_providerId_modelId_kind_key" ON "AiModel" USING btree ("providerId","modelId","kind");
