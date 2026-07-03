ALTER TABLE "UsageEvent" ADD COLUMN "traceId" text;
--> statement-breakpoint
CREATE INDEX "UsageEvent_traceId_timestamp_idx" ON "UsageEvent" USING btree ("traceId", "timestamp");
--> statement-breakpoint
CREATE TABLE "UsageTrace" (
	"endedAt" timestamp (3) with time zone,
	"id" text PRIMARY KEY NOT NULL,
	"metadata" jsonb,
	"name" text NOT NULL,
	"startedAt" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"status" text NOT NULL,
	"userId" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "UsageTrace" ADD CONSTRAINT "UsageTrace_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "UsageTrace_userId_startedAt_idx" ON "UsageTrace" USING btree ("userId", "startedAt");
--> statement-breakpoint
CREATE TABLE "UsageObservation" (
	"endedAt" timestamp (3) with time zone,
	"id" text PRIMARY KEY NOT NULL,
	"metadata" jsonb,
	"name" text NOT NULL,
	"parentObservationId" text,
	"sequence" integer NOT NULL,
	"startedAt" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"status" text NOT NULL,
	"traceId" text NOT NULL,
	"type" text NOT NULL,
	"usageEventId" text
);
--> statement-breakpoint
ALTER TABLE "UsageObservation" ADD CONSTRAINT "UsageObservation_traceId_UsageTrace_id_fk" FOREIGN KEY ("traceId") REFERENCES "public"."UsageTrace"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "UsageObservation_traceId_sequence_idx" ON "UsageObservation" USING btree ("traceId", "sequence");
--> statement-breakpoint
CREATE INDEX "UsageObservation_usageEventId_idx" ON "UsageObservation" USING btree ("usageEventId");
