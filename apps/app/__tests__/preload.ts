import { mock } from "bun:test";

import type { LiteParseConfig, ParseResult } from "@llamaindex/liteparse";

process.env.POSTGRES_DATABASE_URL ??= "postgres://postgres:postgres@127.0.0.1:5432/mdscribe";
process.env.POSTGRES_DATABASE_URL_TEST ??=
	"postgres://postgres:postgres@127.0.0.1:5432/mdscribe_test";

const resolveAsync = <T>(value: T): Promise<T> => Promise.resolve(value);

const MOCK_PAGE_PNG = Buffer.from(
	"iVBORw0KGgoAAAANSUhEUgAAAEAAAABAAQAAAACCEkxzAAAAEklEQVQoz2P4DwUMo4xRBukMAOPT/hB1CzVqAAAAAElFTkSuQmCC",
	"base64",
);

// Single canonical mock generation text so the streamText and generateText
// mocks agree — handlers read `.text` off both paths.
const MOCK_GENERATED_TEXT = "Generated text response";

const createUIMessageStream = (options?: {
	execute: (input: {
		writer: { merge: (stream: ReadableStream<unknown>) => void; write: (part: unknown) => void };
	}) => void;
}) => {
	const encoder = new TextEncoder();

	return new ReadableStream({
		async start(controller) {
			if (options) {
				let mergedStream: ReadableStream<unknown> | undefined;
				options.execute({
					writer: {
						merge: (stream) => {
							mergedStream = stream;
						},
						write: (part) => controller.enqueue(part),
					},
				});
				if (mergedStream) {
					for await (const chunk of mergedStream) {
						controller.enqueue(chunk);
					}
				}
				controller.close();
				return;
			}
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

export const ocrMockState: {
	config?: Partial<LiteParseConfig>;
	result?: Pick<ParseResult, "pages" | "pageErrors" | "text" | "totalPages">;
	error?: Error;
	closed: number;
} = { closed: 0 };

mock.module("@llamaindex/liteparse", () => ({
	LiteParse: class {
		state = ocrMockState;

		constructor(config: Partial<LiteParseConfig>) {
			this.state.config = config;
		}
		parse(_data: Buffer) {
			if (this.state.error) {
				return Promise.reject(this.state.error);
			}
			return Promise.resolve(
				this.state.result ?? {
					pageErrors: [],
					pages: [{ height: 800, pageNum: 1, text: "", textItems: [], width: 600 }],
					text: "",
					totalPages: 1,
				},
			);
		}
		screenshot = (_data: Buffer, pageNumbers: number[]) => {
			if (this.state.error) {
				return Promise.reject(this.state.error);
			}
			return Promise.resolve(
				pageNumbers.map((pageNum) => ({
					height: 64,
					imageBuffer: MOCK_PAGE_PNG,
					pageNum,
					width: 64,
				})),
			);
		};
		close() {
			this.state.closed += 1;
		}
	},
}));

mock.module("@/env", () => ({
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

export const aiMockState: {
	generateTextCallCount: number;
	lastGenerateObjectOptions?: unknown;
	lastGenerateTextOptions?: unknown;
	lastOcrGenerateTextOptions?: unknown;
	nextGenerateTextOutput?: unknown;
	nextOcrOutput?: unknown;
	nextOcrOutputs?: unknown[];
	nextGenerateTextText?: string;
	streamTextCallCount: number;
} = { generateTextCallCount: 0, streamTextCallCount: 0 };

mock.module("ai", () => ({
	Output: {
		object: (options: unknown) => options,
	},
	createUIMessageStream,
	experimental_transcribe: () =>
		resolveAsync({
			text: "Transkribierter Testtext",
		}),
	extractJsonMiddleware: (options?: { transform?: (text: string) => string }) => ({
		kind: "extract-json-middleware",
		...options,
	}),
	generateObject: (options?: unknown) => {
		aiMockState.lastGenerateObjectOptions = options;
		return resolveAsync({
			finishReason: "stop" as const,
			object: {
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
		aiMockState.generateTextCallCount += 1;
		aiMockState.lastGenerateTextOptions = options;
		const promptText =
			options?.messages
				?.map((message) => (typeof message.content === "string" ? message.content : ""))
				.join("\n") ?? "";
		const isFillInputsRequest = promptText.includes("fieldValues");
		let output: unknown;
		if (isFillInputsRequest) {
			output = aiMockState.nextGenerateTextOutput ?? { fieldValues: {} };
			delete aiMockState.nextGenerateTextOutput;
		} else if (promptText.includes("You are an OCR engine")) {
			aiMockState.lastOcrGenerateTextOptions = options;
			output = aiMockState.nextOcrOutputs?.shift() ??
				aiMockState.nextOcrOutput ?? {
					blocks: [
						{
							box_2d: [15.625, 15.625, 234.375, 937.5],
							text: aiMockState.nextGenerateTextText ?? MOCK_GENERATED_TEXT,
						},
					],
					text: aiMockState.nextGenerateTextText ?? MOCK_GENERATED_TEXT,
				};
			delete aiMockState.nextOcrOutput;
			if (aiMockState.nextOcrOutputs?.length === 0) {
				delete aiMockState.nextOcrOutputs;
			}
		}
		const text =
			aiMockState.nextGenerateTextText ?? (output ? JSON.stringify(output) : MOCK_GENERATED_TEXT);
		delete aiMockState.nextGenerateTextText;
		return resolveAsync({
			finishReason: "stop" as const,
			output,
			providerMetadata: {
				openrouter: {
					usage: {
						completionTokens: 25,
						cost: 0.002,
						promptTokens: 50,
						totalTokens: 75,
					},
				},
			},
			text,
			usage: {
				completionTokens: 25,
				promptTokens: 50,
				totalTokens: 75,
			},
		});
	},
	streamText: (options: { onFinish?: (event: unknown) => void }) => {
		aiMockState.streamTextCallCount += 1;
		return createMockStreamResult(options);
	},
	tool: <T>(definition: T): T => definition,
	wrapLanguageModel: (options: unknown) => ({ wrappedLanguageModel: options }),
}));

mock.module("@openrouter/ai-sdk-provider", () => ({
	createOpenRouter: () => createOpenRouterMockModel,
}));
