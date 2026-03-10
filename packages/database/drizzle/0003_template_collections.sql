CREATE TABLE "TemplateCollection" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "TemplateCollectionTemplate" (
	"collectionId" text NOT NULL,
	"templateId" text NOT NULL,
	CONSTRAINT "TemplateCollectionTemplate_collectionId_templateId_pk" PRIMARY KEY("collectionId","templateId")
);
--> statement-breakpoint
ALTER TABLE "TemplateCollection" ADD CONSTRAINT "TemplateCollection_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "TemplateCollectionTemplate" ADD CONSTRAINT "TemplateCollectionTemplate_collectionId_TemplateCollection_id_fk" FOREIGN KEY ("collectionId") REFERENCES "public"."TemplateCollection"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "TemplateCollectionTemplate" ADD CONSTRAINT "TemplateCollectionTemplate_templateId_Template_id_fk" FOREIGN KEY ("templateId") REFERENCES "public"."Template"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "TemplateCollectionTemplate_templateId_idx" ON "TemplateCollectionTemplate" USING btree ("templateId");
