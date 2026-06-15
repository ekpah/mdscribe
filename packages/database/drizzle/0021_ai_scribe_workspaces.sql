CREATE TABLE "AiScribeWorkspace" (
	"id" text PRIMARY KEY NOT NULL,
	"authorId" text,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"diagnosisFormId" text,
	"anamneseFormId" text,
	"epikriseFormId" text,
	"visibility" text DEFAULT 'public' NOT NULL,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "AiScribeWorkspace" ADD CONSTRAINT "AiScribeWorkspace_authorId_User_id_fk" FOREIGN KEY ("authorId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "AiScribeWorkspace" ADD CONSTRAINT "AiScribeWorkspace_diagnosisFormId_AiScribeFormConfig_id_fk" FOREIGN KEY ("diagnosisFormId") REFERENCES "public"."AiScribeFormConfig"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "AiScribeWorkspace" ADD CONSTRAINT "AiScribeWorkspace_anamneseFormId_AiScribeFormConfig_id_fk" FOREIGN KEY ("anamneseFormId") REFERENCES "public"."AiScribeFormConfig"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "AiScribeWorkspace" ADD CONSTRAINT "AiScribeWorkspace_epikriseFormId_AiScribeFormConfig_id_fk" FOREIGN KEY ("epikriseFormId") REFERENCES "public"."AiScribeFormConfig"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "AiScribeWorkspace_slug_key" ON "AiScribeWorkspace" USING btree ("slug");
--> statement-breakpoint
CREATE INDEX "AiScribeWorkspace_authorId_idx" ON "AiScribeWorkspace" USING btree ("authorId");
--> statement-breakpoint
CREATE INDEX "AiScribeWorkspace_enabled_idx" ON "AiScribeWorkspace" USING btree ("enabled");
--> statement-breakpoint
CREATE INDEX "AiScribeWorkspace_visibility_idx" ON "AiScribeWorkspace" USING btree ("visibility");
