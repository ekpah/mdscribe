ALTER TABLE "Subscription" ADD COLUMN "billingInterval" text;--> statement-breakpoint
ALTER TABLE "Subscription" ADD COLUMN "cancelAt" timestamp(3);--> statement-breakpoint
ALTER TABLE "Subscription" ADD COLUMN "canceledAt" timestamp(3);--> statement-breakpoint
ALTER TABLE "Subscription" ADD COLUMN "endedAt" timestamp(3);--> statement-breakpoint
ALTER TABLE "Subscription" ADD COLUMN "stripeScheduleId" text;
