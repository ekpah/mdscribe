CREATE TABLE "DocumentTemplate" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"category" text NOT NULL,
	"authorId" text NOT NULL,
	"fieldDefinitions" jsonb NOT NULL,
	"pdfBytes" bytea NOT NULL,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "DocumentTemplate" ADD CONSTRAINT "DocumentTemplate_authorId_User_id_fk" FOREIGN KEY ("authorId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "DocumentTemplate_authorId_idx" ON "DocumentTemplate" USING btree ("authorId");
--> statement-breakpoint
CREATE INDEX "DocumentTemplate_category_idx" ON "DocumentTemplate" USING btree ("category");
