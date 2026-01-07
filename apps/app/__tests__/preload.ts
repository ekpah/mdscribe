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

// Mock AI SDK - using patterns from AI SDK testing documentation
// See: https://ai-sdk.dev/docs/ai-sdk-core/testing
// Note: We mock at the module level because bun has compatibility issues with ai/test
mock.module("ai", () => {
	/**
	 * Simulates a readable stream with optional delays (matches AI SDK's simulateReadableStream)
	 */
	function simulateReadableStream<T>(options: {
		chunks: T[];
		initialDelayInMs?: number;
		chunkDelayInMs?: number;
	}): ReadableStream<T> {
		const { chunks, initialDelayInMs = 0, chunkDelayInMs = 0 } = options;
		let index = 0;

		return new ReadableStream<T>({
			async start(controller) {
				if (initialDelayInMs > 0) {
					await new Promise((resolve) => setTimeout(resolve, initialDelayInMs));
				}

				for (const chunk of chunks) {
					if (chunkDelayInMs > 0 && index > 0) {
						await new Promise((resolve) => setTimeout(resolve, chunkDelayInMs));
					}
					controller.enqueue(chunk);
					index++;
				}
				controller.close();
			},
		});
	}

	/**
	 * Creates a mock stream result matching AI SDK's streamText return type
	 */
	const createMockStreamResult = (options?: { onFinish?: (event: unknown) => void }) => {
		// Stream chunks following AI SDK v3 format
		const streamChunks = [
			{ type: "text-start" as const, id: "text-1" },
			{ type: "text-delta" as const, id: "text-1", delta: "This " },
			{ type: "text-delta" as const, id: "text-1", delta: "is " },
			{ type: "text-delta" as const, id: "text-1", delta: "a " },
			{ type: "text-delta" as const, id: "text-1", delta: "test " },
			{ type: "text-delta" as const, id: "text-1", delta: "response." },
			{ type: "text-end" as const, id: "text-1" },
			{
				type: "finish" as const,
				finishReason: "stop" as const,
				usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
			},
		];

		const fullText = "This is a test response.";
		const stream = simulateReadableStream({ chunks: streamChunks, chunkDelayInMs: 1 });

		// Create async iterable for UI message stream
		const mockUIStream = {
			async *[Symbol.asyncIterator]() {
				const reader = stream.getReader();
				try {
					while (true) {
						const { done, value } = await reader.read();
						if (done) break;
						yield value;
					}
				} finally {
					reader.releaseLock();
				}
			},
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
			textStream: mockUIStream,
			fullStream: mockUIStream,
			text: Promise.resolve(fullText),
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
		// Export simulateReadableStream for tests that need it
		simulateReadableStream,
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
