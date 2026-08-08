import { mock } from "bun:test";

process.env.POSTGRES_DATABASE_URL ??= "postgres://postgres:postgres@127.0.0.1:5432/mdscribe";
process.env.POSTGRES_DATABASE_URL_TEST ??=
	"postgres://postgres:postgres@127.0.0.1:5432/mdscribe_test";

const resolveAsync = <T>(value: T): Promise<T> => Promise.resolve(value);

// Single canonical mock generation text so the streamText and generateText
// mocks agree — handlers read `.text` off both paths.
const MOCK_GENERATED_TEXT = "Generated text response";

const createUIMessageStream = () => {
	const encoder = new TextEncoder();

	return new ReadableStream({
		start(controller) {
			controller.enqueue(encoder.encode(`0:${JSON.stringify(MOCK_GENERATED_TEXT)}\n`));
			controller.close();
		},
	});
};

const createMockStreamResult = (options?: { onFinish?: (event: unknown) => void }) => {
	const fullText = MOCK_GENERATED_TEXT;
	const onFinish = options?.onFinish;

	if (onFinish) {
		queueMicrotask(() => {
			onFinish({
				finishReason: "stop",
				providerMetadata: {
					openrouter: {
						usage: {
							completion_tokens: 50,
							prompt_tokens: 100,
							total_cost: 0.001,
							total_tokens: 150,
						},
					},
				},
				reasoningText: undefined,
				text: fullText,
				usage: {
					completionTokens: 50,
					promptTokens: 100,
					totalTokens: 150,
				},
			});
		});
	}

	return {
		experimental_providerMetadata: {},
		finishReason: resolveAsync("stop" as const),
		fullStream: createUIMessageStream(),
		text: resolveAsync(fullText),
		textStream: createUIMessageStream(),
		toDataStream: () => createUIMessageStream(),
		toUIMessageStream: () => createUIMessageStream(),
		usage: resolveAsync({
			completionTokens: 50,
			promptTokens: 100,
			totalTokens: 150,
		}),
	};
};

const createOpenRouterMockModel = (modelId: string) => ({
	doGenerate: () =>
		resolveAsync({
			content: [{ text: "Hello, world!", type: "text" as const }],
			finishReason: "stop" as const,
			usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
			warnings: [],
		}),
	doStream: () =>
		resolveAsync({
			stream: new ReadableStream({
				start(controller) {
					controller.enqueue({ id: "text-1", type: "text-start" });
					controller.enqueue({ delta: "Hello, ", id: "text-1", type: "text-delta" });
					controller.enqueue({ delta: "world!", id: "text-1", type: "text-delta" });
					controller.enqueue({ id: "text-1", type: "text-end" });
					controller.enqueue({
						finishReason: "stop",
						type: "finish",
						usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
					});
					controller.close();
				},
			}),
		}),
	modelId,
	provider: "openrouter",
	specificationVersion: "v3",
});

const MockStripe = function MockStripe() {
	return {
		checkout: {
			sessions: {
				create: () =>
					resolveAsync({
						id: "cs_test_123",
						url: "https://checkout.stripe.com/test",
					}),
			},
		},
		customers: {
			create: () => resolveAsync({ id: "cus_test_123" }),
			retrieve: () => resolveAsync({ id: "cus_test_123" }),
		},
		subscriptions: {
			create: () =>
				resolveAsync({
					id: "sub_test_123",
					status: "active",
				}),
			list: () => resolveAsync({ data: [] }),
		},
		webhooks: {
			constructEvent: () => ({ type: "test.event" }),
		},
	};
};

const sendEmailMock = mock(() => resolveAsync({ success: true }));
const sendEmailBatchMock = mock((options: { to?: readonly string[] }) =>
	resolveAsync({
		acceptedCount: options.to?.length ?? 0,
		attemptedCount: options.to?.length ?? 0,
		failedCount: 0,
	}),
);

mock.module("server-only", () => ({}));

mock.module("@repo/env", () => ({
	env: {
		ADMIN_EMAIL: "admin@test.com",
		BETTER_AUTH_SECRET: "test-secret-key-for-testing-32chars",
		MAIL_BROADCAST_SMTP_URL: undefined,
		MAIL_FROM_ADDRESS: "noreply@test.com",
		MAIL_FROM_NAME: "MDScribe Test",
		MAIL_SMTP_URL: "smtp://localhost:1025",
		NEXT_PUBLIC_BASE_URL: "http://localhost:3000",
		NODE_ENV: "test",
		OPENROUTER_API_KEY: "test-key",
		POSTGRES_DATABASE_URL: "mock://test",
		STRIPE_PLUS_PRICE_ID: "price_test_plus",
		STRIPE_PLUS_PRICE_ID_ANNUAL: "price_test_plus_annual",
		STRIPE_SECRET_KEY: "sk_test_mock_key",
		STRIPE_WEBHOOK_SECRET: "whsec_test_secret",
	},
}));

mock.module("next/headers", () => ({
	cookies: () =>
		resolveAsync({
			delete: () => null,
			get: () => null,
			getAll: () => [],
			set: () => null,
		}),
	headers: () => resolveAsync(new Headers()),
}));

mock.module("@repo/email", () => ({
	sendEmail: sendEmailMock,
	sendEmailBatch: sendEmailBatchMock,
}));

mock.module("stripe", () => ({
	Stripe: MockStripe,
	default: MockStripe,
}));

export const aiMockState: { lastGenerateObjectOptions?: unknown } = {};

mock.module("ai", () => ({
	Output: {
		object: (options: unknown) => options,
	},
	experimental_transcribe: () =>
		resolveAsync({
			text: "Transkribierter Testtext",
		}),
	generateObject: (options?: unknown) => {
		aiMockState.lastGenerateObjectOptions = options;
		return resolveAsync({
			finishReason: "stop" as const,
			object: {
				categories: [
					{
						comment: "Testbewertung",
						name: "Aktualität",
						score: 4,
					},
					{
						comment: "Testbewertung",
						name: "Richtigkeit",
						score: 4,
					},
					{
						comment: "Testbewertung",
						name: "Vollständigkeit",
						score: 4,
					},
					{
						comment: "Testbewertung",
						name: "Nützlichkeit",
						score: 4,
					},
					{
						comment: "Testbewertung",
						name: "Organisation",
						score: 4,
					},
					{
						comment: "Testbewertung",
						name: "Verständlichkeit",
						score: 4,
					},
					{
						comment: "Testbewertung",
						name: "Prägnanz",
						score: 4,
					},
					{
						comment: "Testbewertung",
						name: "Synthese",
						score: 4,
					},
					{
						comment: "Testbewertung",
						name: "Innere Konsistenz",
						score: 4,
					},
				],
				fieldDefinitions: {
					bindings: [
						{
							fieldName: "patient_name",
							inputId: "Patient",
							isEnabled: true,
						},
					],
					inputs: [
						{
							attributes: {
								description: "Vollständiger Name der Patientin oder des Patienten",
								primary: "Patient",
								type: "string",
							},
							children: [],
							name: "Info",
						},
					],
				},
				fieldMapping: [
					{
						description: "Patientenname aus dem PDF-Formular",
						fieldName: "patient_name",
						label: "Patient",
					},
				],
				note: "Antwort A bleibt naeher an den Eingaben.",
				preferredResponse: "a" as const,
				summary: "Testzusammenfassung",
				test: "value",
			},
			usage: {
				completionTokens: 25,
				promptTokens: 50,
				totalTokens: 75,
			},
		});
	},
	generateText: (options?: { messages?: { content?: unknown }[] }) => {
		const promptText =
			options?.messages
				?.map((message) => (typeof message.content === "string" ? message.content : ""))
				.join("\n") ?? "";
		const output = promptText.includes("fieldValues") ? { test: "value" } : undefined;
		const text = output ? JSON.stringify(output) : MOCK_GENERATED_TEXT;
		return resolveAsync({
			finishReason: "stop" as const,
			output,
			text,
			usage: {
				completionTokens: 25,
				promptTokens: 50,
				totalTokens: 75,
			},
		});
	},
	streamText: (options: { onFinish?: (event: unknown) => void }) => createMockStreamResult(options),
}));

mock.module("@openrouter/ai-sdk-provider", () => ({
	createOpenRouter: () => createOpenRouterMockModel,
}));
