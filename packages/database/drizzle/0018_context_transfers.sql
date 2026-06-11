CREATE TABLE "ContextTransfer" (
	"id" text PRIMARY KEY NOT NULL,
	"tokenHash" text NOT NULL,
	"userId" text NOT NULL,
	"targetPath" text NOT NULL,
	"ciphertext" text NOT NULL,
	"createdAt" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"expiresAt" timestamp(3) with time zone NOT NULL,
	CONSTRAINT "ContextTransfer_tokenHash_unique" UNIQUE("tokenHash")
);
--> statement-breakpoint
ALTER TABLE "ContextTransfer" ADD CONSTRAINT "ContextTransfer_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "ContextTransfer_expiresAt_idx" ON "ContextTransfer" USING btree ("expiresAt");
--> statement-breakpoint
CREATE INDEX "ContextTransfer_userId_idx" ON "ContextTransfer" USING btree ("userId");
