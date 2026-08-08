ALTER TABLE "AiProvider" ADD COLUMN "byokEnabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE TABLE "UserAiProvider" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"providerId" text NOT NULL,
	"name" text NOT NULL,
	"apiKey" text NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"validatedAt" timestamp(3) with time zone NOT NULL,
	"createdAt" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp(3) with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "UserAiProvider" ADD CONSTRAINT "UserAiProvider_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "UserAiProvider" ADD CONSTRAINT "UserAiProvider_providerId_AiProvider_id_fk" FOREIGN KEY ("providerId") REFERENCES "public"."AiProvider"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "UserAiProvider_userId_providerId_key" ON "UserAiProvider" USING btree ("userId","providerId");--> statement-breakpoint
CREATE INDEX "UserAiProvider_userId_idx" ON "UserAiProvider" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "UserAiProvider_providerId_idx" ON "UserAiProvider" USING btree ("providerId");
