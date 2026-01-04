import { mock } from "bun:test";

// Mock server-only to allow testing server components
mock.module("server-only", () => ({}));

// Mock @repo/env with test values
mock.module("@repo/env", () => ({
	env: {
		POSTGRES_DATABASE_URL: "mock://test",
		OPENROUTER_API_KEY: "test-key",
		AUTH_POSTMARK_KEY: "test-key",
		BETTER_AUTH_SECRET: "test-secret",
		STRIPE_SECRET_KEY: "test-key",
		STRIPE_WEBHOOK_SECRET: "test-secret",
		STRIPE_PLUS_PRICE_ID: "test-price",
		STRIPE_PLUS_PRICE_ID_ANNUAL: "test-price-annual",
		VOYAGE_API_KEY: "test-key",
		LANGFUSE_SECRET_KEY: "test-key",
		LANGFUSE_PUBLIC_KEY: "test-key",
		LANGFUSE_BASEURL: "https://test.langfuse.com",
		NODE_ENV: "test",
		FLAGS_SECRET: "test-secret",
		NEXT_PUBLIC_BASE_URL: "http://localhost:3000",
		NEXT_PUBLIC_POSTHOG_KEY: "test-key",
		NEXT_PUBLIC_POSTHOG_HOST: "https://test.posthog.com",
	},
}));
