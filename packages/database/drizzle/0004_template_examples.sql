CREATE TABLE "TemplateExample" (
	"id" text PRIMARY KEY NOT NULL,
	"templateId" text NOT NULL,
	"content" text NOT NULL,
	"position" integer NOT NULL,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "TemplateExample" ADD CONSTRAINT "TemplateExample_templateId_Template_id_fk" FOREIGN KEY ("templateId") REFERENCES "public"."Template"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "TemplateExample_templateId_idx" ON "TemplateExample" USING btree ("templateId");--> statement-breakpoint
CREATE UNIQUE INDEX "TemplateExample_templateId_position_key" ON "TemplateExample" USING btree ("templateId","position");
