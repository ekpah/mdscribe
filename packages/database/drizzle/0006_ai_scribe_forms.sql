CREATE TABLE "AiScribeFormConfig" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"inputPreset" text NOT NULL,
	"promptHarness" text NOT NULL,
	"templateId" text,
	"modelId" text,
	"temperature" numeric(3, 2),
	"maxTokens" integer,
	"thinkingBudget" integer,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "AiScribeFormConfig" ADD CONSTRAINT "AiScribeFormConfig_templateId_Template_id_fk" FOREIGN KEY ("templateId") REFERENCES "public"."Template"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "AiScribeFormConfig" ADD CONSTRAINT "AiScribeFormConfig_modelId_AiModel_id_fk" FOREIGN KEY ("modelId") REFERENCES "public"."AiModel"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "AiScribeFormConfig_slug_key" ON "AiScribeFormConfig" USING btree ("slug");
--> statement-breakpoint
CREATE INDEX "AiScribeFormConfig_enabled_idx" ON "AiScribeFormConfig" USING btree ("enabled");
