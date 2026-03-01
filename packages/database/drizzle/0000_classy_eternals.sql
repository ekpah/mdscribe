CREATE TABLE "Account" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"accountId" text NOT NULL,
	"providerId" text NOT NULL,
	"accessToken" text,
	"refreshToken" text,
	"accessTokenExpiresAt" timestamp (3),
	"refreshTokenExpiresAt" timestamp (3),
	"scope" text,
	"idToken" text,
	"password" text,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "AiConnection" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"protocol" text NOT NULL,
	"baseUrl" text,
	"apiKeyEncrypted" text,
	"isEnabled" boolean DEFAULT true NOT NULL,
	"sortOrder" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "AiModel" (
	"id" text PRIMARY KEY NOT NULL,
	"connectionId" text NOT NULL,
	"modelId" text NOT NULL,
	"displayName" text NOT NULL,
	"isEnabled" boolean DEFAULT true NOT NULL,
	"supportsThinking" boolean DEFAULT false NOT NULL,
	"supportsAudio" boolean DEFAULT false NOT NULL,
	"supportsFiles" boolean DEFAULT false NOT NULL,
	"sortOrder" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "_favourites" (
	"A" text NOT NULL,
	"B" text NOT NULL,
	CONSTRAINT "_favourites_A_B_pk" PRIMARY KEY("A","B")
);
--> statement-breakpoint
CREATE TABLE "Session" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"token" text NOT NULL,
	"expiresAt" timestamp (3) NOT NULL,
	"ipAddress" text,
	"userAgent" text,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) NOT NULL,
	CONSTRAINT "Session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "Subscription" (
	"id" text PRIMARY KEY NOT NULL,
	"plan" text NOT NULL,
	"referenceId" text NOT NULL,
	"stripeCustomerId" text,
	"stripeSubscriptionId" text,
	"status" text NOT NULL,
	"periodStart" timestamp (3),
	"periodEnd" timestamp (3),
	"cancelAtPeriodEnd" boolean,
	"seats" integer,
	"trialStart" timestamp (3),
	"trialEnd" timestamp (3),
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Template" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"category" text NOT NULL,
	"content" text NOT NULL,
	"authorId" text NOT NULL,
	"updatedAt" timestamp (3) DEFAULT now() NOT NULL,
	"embedding" vector(1024)
);
--> statement-breakpoint
CREATE TABLE "TextSnippet" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"key" text NOT NULL,
	"snippet" text NOT NULL,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "UsageEvent" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"timestamp" timestamp (3) DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"inputTokens" integer,
	"outputTokens" integer,
	"totalTokens" integer,
	"reasoningTokens" integer,
	"cachedTokens" integer,
	"cost" numeric(10, 6),
	"model" text,
	"inputData" jsonb,
	"metadata" jsonb,
	"result" text,
	"reasoning" text
);
--> statement-breakpoint
CREATE TABLE "User" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"email" text NOT NULL,
	"emailVerified" boolean DEFAULT false NOT NULL,
	"image" text,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) NOT NULL,
	"stripeCustomerId" text,
	CONSTRAINT "User_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "Verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expiresAt" timestamp (3) NOT NULL,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "AiModel" ADD CONSTRAINT "AiModel_connectionId_AiConnection_id_fk" FOREIGN KEY ("connectionId") REFERENCES "public"."AiConnection"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "_favourites" ADD CONSTRAINT "_favourites_A_Template_id_fk" FOREIGN KEY ("A") REFERENCES "public"."Template"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "_favourites" ADD CONSTRAINT "_favourites_B_User_id_fk" FOREIGN KEY ("B") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_referenceId_User_id_fk" FOREIGN KEY ("referenceId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Template" ADD CONSTRAINT "Template_authorId_User_id_fk" FOREIGN KEY ("authorId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "TextSnippet" ADD CONSTRAINT "TextSnippet_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "UsageEvent" ADD CONSTRAINT "UsageEvent_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "_favourites_B_index" ON "_favourites" USING btree ("B");--> statement-breakpoint
CREATE UNIQUE INDEX "TextSnippet_userId_key_key" ON "TextSnippet" USING btree ("userId","key");--> statement-breakpoint
CREATE INDEX "UsageEvent_userId_timestamp_idx" ON "UsageEvent" USING btree ("userId","timestamp");--> statement-breakpoint
CREATE INDEX "UsageEvent_name_timestamp_idx" ON "UsageEvent" USING btree ("name","timestamp");