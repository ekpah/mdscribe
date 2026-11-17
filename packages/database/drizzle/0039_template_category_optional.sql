ALTER TABLE "Template" ALTER COLUMN "category" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "DocumentTemplate" ALTER COLUMN "category" DROP NOT NULL;--> statement-breakpoint
DROP INDEX IF EXISTS "DocumentTemplate_category_idx";
