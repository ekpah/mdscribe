import { mock } from "bun:test";

// Mock server-only to allow testing server components
mock.module("server-only", () => ({}));

// Mock @repo/env with test values
mock.module("@repo/env", () => ({
	env: {
		POSTGRES_DATABASE_URL: "mock://test",
		OPENROUTER_API_KEY: "test-key",
		AUTH_POSTMARK_KEY: "test-key",
		BETTER_AUTH_SECRET: "test-secret-key-for-testing-32chars",
		STRIPE_SECRET_KEY: "sk_test_mock_key",
		STRIPE_WEBHOOK_SECRET: "whsec_test_secret",
		STRIPE_PLUS_PRICE_ID: "price_test_plus",
		STRIPE_PLUS_PRICE_ID_ANNUAL: "price_test_plus_annual",
		VOYAGE_API_KEY: "test-voyage-key",
		LANGFUSE_SECRET_KEY: "test-langfuse-key",
		LANGFUSE_PUBLIC_KEY: "test-langfuse-public-key",
		LANGFUSE_BASEURL: "https://test.langfuse.com",
		NODE_ENV: "test",
		FLAGS_SECRET: "test-flags-secret",
		NEXT_PUBLIC_BASE_URL: "http://localhost:3000",
		NEXT_PUBLIC_POSTHOG_KEY: "test-posthog-key",
		NEXT_PUBLIC_POSTHOG_HOST: "https://test.posthog.com",
	},
}));

// Mock next/headers to avoid runtime errors in tests
mock.module("next/headers", () => ({
	headers: async () => new Headers(),
	cookies: async () => ({
		get: () => null,
		set: () => {},
		delete: () => {},
		getAll: () => [],
	}),
}));

// Mock Langfuse
mock.module("langfuse", () => ({
	Langfuse: class MockLangfuse {
		getPrompt() {
			return Promise.resolve({
				compile: (variables: Record<string, unknown>) => [
					{
						role: "system",
						content: `Test system prompt with variables: ${JSON.stringify(variables)}`,
					},
					{ role: "user", content: "Test user message" },
				],
			});
		}
		trace() {
			return { id: "test-trace-id" };
		}
		span() {
			return { id: "test-span-id", end: () => {} };
		}
		generation() {
			return { id: "test-gen-id", end: () => {} };
		}
		flush() {
			return Promise.resolve();
		}
	},
	default: class MockLangfuse {
		getPrompt() {
			return Promise.resolve({
				compile: (variables: Record<string, unknown>) => [
					{
						role: "system",
						content: `Test system prompt with variables: ${JSON.stringify(variables)}`,
					},
					{ role: "user", content: "Test user message" },
				],
			});
		}
	},
}));

// Mock VoyageAI
mock.module("voyageai", () => ({
	VoyageAIClient: class MockVoyageAIClient {
		embed() {
			// Return a mock 1024-dimensional embedding
			const mockEmbedding = Array.from({ length: 1024 }, () => Math.random());
			return Promise.resolve({
				data: [{ embedding: mockEmbedding }],
			});
		}
	},
}));

// Mock @repo/email to avoid email sending during tests
mock.module("@repo/email", () => ({
	sendEmail: async () => ({ success: true }),
}));

// Mock Stripe
mock.module("stripe", () => ({
	default: class MockStripe {
		customers = {
			create: async () => ({ id: "cus_test_123" }),
			retrieve: async () => ({ id: "cus_test_123" }),
		};
		subscriptions = {
			list: async () => ({ data: [] }),
			create: async () => ({ id: "sub_test_123", status: "active" }),
		};
		checkout = {
			sessions: {
				create: async () => ({ id: "cs_test_123", url: "https://checkout.stripe.com/test" }),
			},
		};
		webhooks = {
			constructEvent: () => ({ type: "test.event" }),
		};
	},
}));

// Mock AI SDK - streamText function
// This creates a mock stream that simulates AI responses
mock.module("ai", () => {
	// Create a mock stream result
	const createMockStreamResult = (options?: { onFinish?: (event: unknown) => void }) => {
		const textChunks = ["This ", "is ", "a ", "test ", "response."];

		const mockUIStream = {
			async *[Symbol.asyncIterator]() {
				for (const chunk of textChunks) {
					yield {
						type: "text-delta" as const,
						textDelta: chunk,
					};
				}
			},
		};

		// Schedule onFinish callback
		if (options?.onFinish) {
			setTimeout(() => {
				options.onFinish!({
					text: textChunks.join(""),
					usage: {
						promptTokens: 100,
						completionTokens: 50,
						totalTokens: 150,
					},
					finishReason: "stop",
					providerMetadata: {
						openrouter: {
							usage: {
								prompt_tokens: 100,
								completion_tokens: 50,
								total_tokens: 150,
								total_cost: 0.001,
							},
						},
					},
					reasoningText: undefined,
				});
			}, 10);
		}

		return {
			textStream: mockUIStream,
			fullStream: mockUIStream,
			text: Promise.resolve(textChunks.join("")),
			usage: Promise.resolve({
				promptTokens: 100,
				completionTokens: 50,
				totalTokens: 150,
			}),
			finishReason: Promise.resolve("stop" as const),
			experimental_providerMetadata: {},
			toUIMessageStream: () => mockUIStream,
			toDataStream: () => mockUIStream,
		};
	};

	return {
		streamText: (options: { onFinish?: (event: unknown) => void }) => {
			return createMockStreamResult(options);
		},
		generateText: async () => ({
			text: "Generated text response",
			usage: {
				promptTokens: 50,
				completionTokens: 25,
				totalTokens: 75,
			},
			finishReason: "stop" as const,
		}),
		generateObject: async () => ({
			object: { test: "value" },
			usage: {
				promptTokens: 50,
				completionTokens: 25,
				totalTokens: 75,
			},
			finishReason: "stop" as const,
		}),
	};
});

// Mock OpenRouter provider
mock.module("@openrouter/ai-sdk-provider", () => ({
	createOpenRouter: () => {
		const mockModel = (modelId: string) => ({
			modelId,
			provider: "openrouter",
			specificationVersion: "v1",
		});
		return mockModel;
	},
}));
