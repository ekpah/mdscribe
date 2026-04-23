ALTER TABLE "DocumentTemplate" DROP COLUMN IF EXISTS "parsedMarkdoc";
--> statement-breakpoint
ALTER TABLE "DocumentTemplate" DROP COLUMN IF EXISTS "pdfFileName";
--> statement-breakpoint
ALTER TABLE "DocumentTemplate" DROP COLUMN IF EXISTS "pdfMimeType";
--> statement-breakpoint
ALTER TABLE "DocumentTemplate" DROP COLUMN IF EXISTS "pdfByteSize";
--> statement-breakpoint
ALTER TABLE "DocumentTemplate" DROP COLUMN IF EXISTS "pdfSha256";
