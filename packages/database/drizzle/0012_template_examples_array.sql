ALTER TABLE "Template" ADD COLUMN "examples" text[] DEFAULT '{}'::text[] NOT NULL;
--> statement-breakpoint
UPDATE "Template"
SET "examples" = COALESCE(
	(
		SELECT array_agg("TemplateExample"."content" ORDER BY "TemplateExample"."createdAt", "TemplateExample"."id")
		FROM "TemplateExample"
		WHERE "TemplateExample"."templateId" = "Template"."id"
	),
	'{}'::text[]
);
--> statement-breakpoint
DROP TABLE "TemplateExample";
