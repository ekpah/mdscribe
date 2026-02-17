import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

const server: Parameters<typeof createEnv>[0]["server"] = {
	POSTGRES_DATABASE_URL: z.string().min(1).url(),

	ADMIN_EMAIL: z.string().email(),

	ANALYZE: z.string().optional(),

	OPENROUTER_API_KEY: z.string().min(1),

	AUTH_POSTMARK_KEY: z.string().min(1),

	BETTER_AUTH_SECRET: z.string().min(1),

	STRIPE_SECRET_KEY: z.string().min(1),
	STRIPE_WEBHOOK_SECRET: z.string().min(1),
	STRIPE_PLUS_PRICE_ID: z.string().min(1),
	STRIPE_PLUS_PRICE_ID_ANNUAL: z.string().min(1),
	VOYAGE_API_KEY: z.string().min(1),

	// Added by Node
	NODE_ENV: z.enum(["development", "production"]).default("development"),
	CI: z.string().optional(),

	// Added by Vercel
	VERCEL: z.string().optional(),
	NEXT_RUNTIME: z.enum(["nodejs", "edge"]).optional(),
};

const client: Parameters<typeof createEnv>[0]["client"] = {
	NEXT_PUBLIC_BASE_URL: z.string().min(1).url(),
};

export const env = createEnv({
	client,
	server,
	runtimeEnv: {
		POSTGRES_DATABASE_URL: process.env.POSTGRES_DATABASE_URL,
		ADMIN_EMAIL: process.env.ADMIN_EMAIL,
		OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
		AUTH_POSTMARK_KEY: process.env.AUTH_POSTMARK_KEY,
		ANALYZE: process.env.ANALYZE,
		NODE_ENV: process.env.NODE_ENV,
		CI: process.env.CI,
		BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
		NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL,
		STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
		STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
		STRIPE_PLUS_PRICE_ID: process.env.STRIPE_PLUS_PRICE_ID,
		STRIPE_PLUS_PRICE_ID_ANNUAL: process.env.STRIPE_PLUS_PRICE_ID_ANNUAL,
		VERCEL: process.env.VERCEL,
		NEXT_RUNTIME: process.env.NEXT_RUNTIME,
		VOYAGE_API_KEY: process.env.VOYAGE_API_KEY,
	},
});
