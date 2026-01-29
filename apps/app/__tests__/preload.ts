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
		ADMIN_EMAIL: "admin@test.com",
		NODE_ENV: "test",
		FLAGS_SECRET: "test-flags-secret",
		NEXT_PUBLIC_BASE_URL: "http://localhost:3000",
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

// Mock AI SDK - using patterns from AI SDK testing documentation
// See: https://ai-sdk.dev/docs/ai-sdk-core/testing
// Note: We mock at the module level because bun has compatibility issues with ai/test
mock.module("ai", () => {
	/**
	 * Creates a mock stream result matching AI SDK's streamText return type
	 * Returns a proper ReadableStream for toUIMessageStream() so oRPC's streamToEventIterator works
	 */
	const createMockStreamResult = (options?: { onFinish?: (event: unknown) => void }) => {
		const fullText = "This is a test response.";

		// Create a proper ReadableStream for UI message stream (required by oRPC's streamToEventIterator)
		const createUIMessageStream = () => {
			const encoder = new TextEncoder();
			return new ReadableStream({
				start(controller) {
					// Enqueue some mock UI message stream data
					controller.enqueue(encoder.encode('0:"This is a test response."\n'));
					controller.close();
				},
			});
		};

		// Schedule onFinish callback (simulates stream completion)
		if (options?.onFinish) {
			setTimeout(() => {
				options.onFinish!({
					text: fullText,
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
			}, 50);
		}

		return {
			textStream: createUIMessageStream(),
			fullStream: createUIMessageStream(),
			text: Promise.resolve(fullText),
			usage: Promise.resolve({
				promptTokens: 100,
				completionTokens: 50,
				totalTokens: 150,
			}),
			finishReason: Promise.resolve("stop" as const),
			experimental_providerMetadata: {},
			toUIMessageStream: () => createUIMessageStream(),
			toDataStream: () => createUIMessageStream(),
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

// Mock OpenRouter provider to return a MockLanguageModelV3-compatible model
mock.module("@openrouter/ai-sdk-provider", () => ({
	createOpenRouter: () => {
		/**
		 * Creates a mock model following AI SDK's LanguageModelV3 specification
		 */
		const mockModel = (modelId: string) => ({
			modelId,
			provider: "openrouter",
			specificationVersion: "v3",
			// LanguageModelV3 interface methods
			doGenerate: async () => ({
				finishReason: "stop" as const,
				usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
				content: [{ type: "text" as const, text: "Hello, world!" }],
				warnings: [],
			}),
			doStream: async () => ({
				stream: new ReadableStream({
					start(controller) {
						controller.enqueue({ type: "text-start", id: "text-1" });
						controller.enqueue({ type: "text-delta", id: "text-1", delta: "Hello, " });
						controller.enqueue({ type: "text-delta", id: "text-1", delta: "world!" });
						controller.enqueue({ type: "text-end", id: "text-1" });
						controller.enqueue({
							type: "finish",
							finishReason: "stop",
							usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
						});
						controller.close();
					},
				}),
			}),
		});
		return mockModel;
	},
}));
