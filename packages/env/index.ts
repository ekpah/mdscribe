import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

const smtpUrlSchema = z
	.string()
	.url()
	.refine((value) => ["smtp:", "smtps:"].includes(new URL(value).protocol), {
		message: "Expected an smtp: or smtps: URL",
	});

const optionalSmtpUrlSchema = z.preprocess(
	(value) => (value === "" ? undefined : value),
	smtpUrlSchema.optional(),
);

const server: Parameters<typeof createEnv>[0]["server"] = {
	ADMIN_EMAIL: z.string().email(),
	ANALYZE: z.string().optional(),
	BETTER_AUTH_SECRET: z.string().min(1),

	// Added by Node
	CI: z.string().optional(),
	MAIL_BROADCAST_SMTP_URL: optionalSmtpUrlSchema,
	MAIL_FROM_ADDRESS: z.string().email(),
	MAIL_FROM_NAME: z.string().trim().min(1).max(128),
	MAIL_SMTP_URL: smtpUrlSchema,
	// Signed, offline-verified license key that unlocks paid (seat-gated)
	// configurations. Absent = free community configuration.
	MDSCRIBE_LICENSE_KEY: z.string().optional(),
	NEXT_RUNTIME: z.enum(["nodejs", "edge"]).optional(),
	NODE_ENV: z.enum(["development", "production"]).default("development"),
	POSTGRES_DATABASE_URL: z.string().min(1).url(),
	STRIPE_PLUS_PRICE_ID: z.string().min(1),
	STRIPE_PLUS_PRICE_ID_ANNUAL: z.string().min(1),
	STRIPE_SECRET_KEY: z.string().min(1),
	STRIPE_WEBHOOK_SECRET: z.string().min(1),
	// Added by Vercel
	VERCEL: z.string().optional(),
};

const client: Parameters<typeof createEnv>[0]["client"] = {
	NEXT_PUBLIC_BASE_URL: z.string().min(1).url(),
};

export const env = createEnv({
	client,
	runtimeEnv: {
		ADMIN_EMAIL: process.env.ADMIN_EMAIL,
		ANALYZE: process.env.ANALYZE,
		BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
		CI: process.env.CI,
		MAIL_BROADCAST_SMTP_URL: process.env.MAIL_BROADCAST_SMTP_URL,
		MAIL_FROM_ADDRESS: process.env.MAIL_FROM_ADDRESS,
		MAIL_FROM_NAME: process.env.MAIL_FROM_NAME,
		MAIL_SMTP_URL: process.env.MAIL_SMTP_URL,
		MDSCRIBE_LICENSE_KEY: process.env.MDSCRIBE_LICENSE_KEY,
		NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL,
		NEXT_RUNTIME: process.env.NEXT_RUNTIME,
		NODE_ENV: process.env.NODE_ENV,
		POSTGRES_DATABASE_URL: process.env.POSTGRES_DATABASE_URL,
		STRIPE_PLUS_PRICE_ID: process.env.STRIPE_PLUS_PRICE_ID,
		STRIPE_PLUS_PRICE_ID_ANNUAL: process.env.STRIPE_PLUS_PRICE_ID_ANNUAL,
		STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
		STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
		VERCEL: process.env.VERCEL,
	},
	server,
	skipValidation: !!process.env.SKIP_ENV_VALIDATION,
});
