import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { ORPCError, call } from "@orpc/server";
import { aiDefaults, aiModel, aiProvider, eq, usageEvent } from "@repo/database";

import type { TestServer } from "@/__tests__/setup";
import {
	createMockSession,
	createTestAiDefaults,
	createTestContext,
	createTestSubscription,
	createTestUser,
	startTestServer,
} from "@/__tests__/setup";
import { encrypt } from "@/lib/encryption";
import { FILL_INPUT_PAYLOAD_LIMITS } from "@/lib/input-fill-limits";
import {
	AI_INPUT_FILL_EVENT_NAME,
	AI_SCRIBE_OCR_EVENT_NAME,
	AI_SCRIBE_STT_EVENT_NAME,
} from "@/lib/usage-event-names";
import { USER_MESSAGES } from "@/lib/user-messages";
import { documentTypeConfigs } from "@/orpc/scribe/config";
import { composeScribeContext } from "@/orpc/scribe/context";
import { scribeStreamHandler } from "@/orpc/scribe/handlers";
import { prepareAudioInputForModel } from "@/orpc/scribe/handlers/audio-input";
import { fillInputsHandler } from "@/orpc/scribe/handlers/fill-inputs";
import { DEFAULT_SCRIBE_MODEL_CONFIG } from "@/orpc/scribe/handlers/scribe-stream";
import { scribeAgentGenerateSectionHandler } from "@/orpc/scribe-agent/generate-section";
import { composeFillInputsPrompt } from "@/orpc/scribe/prompts/core/fill-inputs";
import {
	getDocumentTypeByPromptName,
	PROMPT_HARNESS_IDS,
	PROMPT_HARNESS_OPTIONS,
} from "@/orpc/scribe/prompts";
import {
	buildProviderOptions,
	resolveAgentGenerationStrategy,
	resolveDefaultModel,
	resolveGenerationStrategy,
} from "@/orpc/scribe/providers";
import type { ResolvedModel } from "@/orpc/scribe/providers";
import type { DocumentType } from "@/orpc/scribe/types";

/**
 * Comprehensive tests for scribe oRPC handlers
 *
 * Includes:
 * - Unit tests for document type configurations
 * - Integration tests for streaming handlers (with mocked AI SDK)
 * - Usage limit and subscription tests
 */
describe("Document Type Configurations", () => {
	test("all document types have required config", () => {
		const documentTypes: DocumentType[] = [
			"discharge",
			"anamnese",
			"diagnosis",
			"procedures",
			"befunde",
			"outpatient",
			"icu-transfer",
		];

		for (const type of documentTypes) {
			expect(documentTypeConfigs[type]).toBeDefined();
			expect(documentTypeConfigs[type].promptName).toBeDefined();
		}
	});

	test("uses one default model config for all scribe generations", () => {
		// Temperature is intentionally omitted here: it resolves per model slot from
		// the admin-configured AiDefaults.default*Temperature at generation time.
		expect(DEFAULT_SCRIBE_MODEL_CONFIG).toEqual({
			maxTokens: 8000,
		});
	});

	test("keeps prompt harness references stable while display names can change", () => {
		expect(PROMPT_HARNESS_IDS).toContain("procedures");
		expect(PROMPT_HARNESS_OPTIONS).toContainEqual({
			id: "procedures",
			label: "Eingriffsdokumentation",
		});
		expect(getDocumentTypeByPromptName("procedures")).toBe("procedures");
		expect(getDocumentTypeByPromptName("procedure")).toBe("procedures");
		expect(getDocumentTypeByPromptName("Befund")).toBe("procedures");
		expect(getDocumentTypeByPromptName("Procedure_chat")).toBe("procedures");
	});
});

describe("Context Builder", () => {
	test("builds unified context envelope with patient sections and omits empty tags", async () => {
		const { contextXml } = await composeScribeContext({
			formData: {
				anamnese: "Akute Dyspnoe",
				diagnoseblock: "I10 Hypertonie",
				notes: "Zusätzliche Notizen",
			},
			sessionUser: null,
		});

		expect(contextXml).toContain("<context>");
		expect(contextXml).toContain("<patient_context>");
		expect(contextXml).toContain("<diagnoseblock>");
		expect(contextXml).toContain("<anamnese>");
		expect(contextXml).toContain("<notizen>");
		expect(contextXml).not.toContain("<befunde>");
	});

	test("includes user_context when name is provided", async () => {
		const session = createMockSession({
			email: "doctor@test.com",
			id: crypto.randomUUID(),
			name: "Dr. Test",
		});
		const { contextXml } = await composeScribeContext({
			formData: {},
			sessionUser: session.user,
		});

		expect(contextXml).toContain("<context>");
		expect(contextXml).toContain("<user_context>");
		expect(contextXml).toContain(
			"<purpose>Informationen über den Arzt/Nutzer, der den Prompt ausfüllt</purpose>",
		);
		expect(contextXml).toContain("Diese Daten gehören NICHT zum Patientenfall");
		expect(contextXml).toContain("<name>Dr. Test</name>");
	});

	test("emits template_context with template content and examples", async () => {
		const { contextXml } = await composeScribeContext({
			formData: {},
			sessionUser: null,
			template: {
				content: "## Abschnitt",
				examples: ["Beispiel A", "Beispiel B"],
				title: "ER Vorlage",
			},
		});

		expect(contextXml).toContain("<template_context>");
		expect(contextXml).toContain("<markdoc_tag_guidance>");
		expect(contextXml).toContain("<title>\nER Vorlage\n</title>");
		expect(contextXml).toContain("<content>\n## Abschnitt\n</content>");
		expect(contextXml).toContain("<example>\nBeispiel A\n</example>");
		expect(contextXml).toContain("<example>\nBeispiel B\n</example>");
		expect(contextXml).toContain("<context>");
	});

	test("uses fallback template when promptContextKey is set and no explicit template exists", async () => {
		const { contextXml } = await composeScribeContext({
			formData: { notes: "Kurznotiz" },
			promptContextKey: "discharge",
			sessionUser: null,
		});

		expect(contextXml).toContain("<template_context>");
		expect(contextXml).toContain("Standardstruktur Entlassbrief");
		expect(contextXml.indexOf("<template_context>")).toBeLessThan(
			contextXml.indexOf("<patient_context>"),
		);
	});
});

describe("Model Selection Logic", () => {
	test("resolveGenerationStrategy sends media natively when standard model capabilities are declared", async () => {
		const server = await startTestServer("resolve-model-standard-capabilities");
		try {
			const providerId = crypto.randomUUID();
			const standardModelRecordId = crypto.randomUUID();

			await server.db.insert(aiProvider).values({
				apiKey: null,
				baseUrl: null,
				id: providerId,
				name: "Test Provider",
				protocol: "openrouter",
			});
			await server.db.insert(aiModel).values([
				{
					displayName: "Standard Model",
					id: standardModelRecordId,
					modelId: "openrouter/test-standard",
					providerId,
					supportedParameters: ["reasoning"],
					supportsReasoning: true,
				},
			]);
			await server.db
				.insert(aiDefaults)
				.values({
					defaultStandardSupportsAudio: true,
					defaultStandardSupportsDocuments: true,
					defaultTextModelId: standardModelRecordId,
					defaultTextReasoningEffort: "high",
					id: "global",
					updatedAt: new Date(),
				})
				.onConflictDoUpdate({
					set: {
						defaultStandardSupportsAudio: true,
						defaultStandardSupportsDocuments: true,
						defaultTextModelId: standardModelRecordId,
						defaultTextReasoningEffort: "high",
						updatedAt: new Date(),
					},
					target: aiDefaults.id,
				});

			const strategy = await resolveGenerationStrategy(server.db, {
				hasAudio: true,
				hasFiles: true,
			});
			expect(strategy.audio).toEqual({ mode: "native" });
			expect(strategy.files).toEqual({ mode: "native" });
			expect(strategy.generation.model.modelName).toBe("openrouter/test-standard");
			expect(strategy.generation.reasoningEffort).toBe("high");
		} finally {
			await server.close();
		}
	});

	test("resolveAgentGenerationStrategy uses dedicated agent slot when standard agent capability is off", async () => {
		const server = await startTestServer("resolve-agent-model-slot");
		try {
			const providerId = crypto.randomUUID();
			const textModelRecordId = crypto.randomUUID();
			const agentModelRecordId = crypto.randomUUID();
			const audioModelRecordId = crypto.randomUUID();
			const fileModelRecordId = crypto.randomUUID();

			await server.db.insert(aiProvider).values({
				apiKey: null,
				baseUrl: null,
				id: providerId,
				name: "Test Provider",
				protocol: "openrouter",
			});
			await server.db.insert(aiModel).values([
				{
					displayName: "Text Model",
					id: textModelRecordId,
					modelId: "openrouter/test-text",
					providerId,
					supportsReasoning: false,
				},
				{
					displayName: "Agent Model",
					id: agentModelRecordId,
					modelId: "openrouter/test-agent",
					providerId,
					supportedParameters: ["reasoning"],
					supportsReasoning: true,
				},
				{
					displayName: "Audio Model",
					id: audioModelRecordId,
					modelId: "openrouter/test-audio",
					providerId,
					supportsReasoning: false,
				},
				{
					displayName: "File Model",
					id: fileModelRecordId,
					modelId: "openrouter/test-file",
					providerId,
					supportsReasoning: false,
				},
			]);
			await server.db
				.insert(aiDefaults)
				.values({
					defaultAgentModelId: agentModelRecordId,
					defaultAgentReasoningEffort: "high",
					defaultAgentSupportsAudio: true,
					defaultAgentSupportsDocuments: false,
					defaultFileImageModelId: fileModelRecordId,
					defaultSpeechToTextModelId: audioModelRecordId,
					defaultStandardSupportsAgent: false,
					defaultTextModelId: textModelRecordId,
					id: "global",
					updatedAt: new Date(),
				})
				.onConflictDoUpdate({
					set: {
						defaultAgentModelId: agentModelRecordId,
						defaultAgentReasoningEffort: "high",
						defaultAgentSupportsAudio: true,
						defaultAgentSupportsDocuments: false,
						defaultFileImageModelId: fileModelRecordId,
						defaultSpeechToTextModelId: audioModelRecordId,
						defaultStandardSupportsAgent: false,
						defaultTextModelId: textModelRecordId,
						updatedAt: new Date(),
					},
					target: aiDefaults.id,
				});

			const strategy = await resolveAgentGenerationStrategy(server.db, {
				hasAudio: true,
				hasFiles: true,
			});
			expect(strategy.usesStandardModel).toBe(false);
			expect(strategy.generation.slot).toBe("agent");
			expect(strategy.generation.model.modelName).toBe("openrouter/test-agent");
			expect(strategy.generation.reasoningEffort).toBe("high");
			expect(strategy.audio).toEqual({ mode: "native" });
			expect(strategy.files).toMatchObject({
				mode: "preprocess",
				selection: { slot: "file-image" },
				strategy: "multimodal",
			});
		} finally {
			await server.close();
		}
	});

	test("resolveGenerationStrategy uses standard model without media plans for text-only input", async () => {
		const server = await startTestServer("resolve-model-text-only-default");
		try {
			const providerId = crypto.randomUUID();
			const textModelRecordId = crypto.randomUUID();

			await server.db.insert(aiProvider).values({
				apiKey: null,
				baseUrl: null,
				id: providerId,
				name: "Test Provider",
				protocol: "openrouter",
			});
			await server.db.insert(aiModel).values([
				{
					displayName: "Text Model",
					id: textModelRecordId,
					modelId: "openrouter/test-text",
					providerId,
					supportsReasoning: false,
				},
			]);
			await server.db
				.insert(aiDefaults)
				.values({
					defaultTextModelId: textModelRecordId,
					defaultTextReasoningEffort: "low",
					id: "global",
					updatedAt: new Date(),
				})
				.onConflictDoUpdate({
					set: {
						defaultTextModelId: textModelRecordId,
						defaultTextReasoningEffort: "low",
						updatedAt: new Date(),
					},
					target: aiDefaults.id,
				});

			const strategy = await resolveGenerationStrategy(server.db, {
				hasAudio: false,
				hasFiles: false,
			});
			expect(strategy.generation.model.modelName).toBe("openrouter/test-text");
			expect(strategy.generation.reasoningEffort).toBe("low");
			expect(strategy.audio).toBeUndefined();
			expect(strategy.files).toBeUndefined();
		} finally {
			await server.close();
		}
	});

	test("resolveGenerationStrategy preprocesses audio when the audio capability is not declared", async () => {
		const server = await startTestServer("resolve-model-audio-default");
		try {
			const providerId = crypto.randomUUID();
			const textModelRecordId = crypto.randomUUID();
			const speechModelRecordId = crypto.randomUUID();

			await server.db.insert(aiProvider).values({
				apiKey: null,
				baseUrl: null,
				id: providerId,
				name: "Test Provider",
				protocol: "openrouter",
			});
			await server.db.insert(aiModel).values([
				{
					displayName: "Text Model",
					id: textModelRecordId,
					modelId: "openrouter/test-text",
					providerId,
					supportsReasoning: false,
				},
				{
					displayName: "Speech Model",
					id: speechModelRecordId,
					modelId: "openrouter/test-speech",
					providerId,
					supportsReasoning: false,
				},
			]);
			await server.db
				.insert(aiDefaults)
				.values({
					defaultFileImageModelId: textModelRecordId,
					defaultSpeechToTextModelId: speechModelRecordId,
					defaultStandardSupportsAudio: false,
					defaultTextModelId: textModelRecordId,
					id: "global",
					updatedAt: new Date(),
				})
				.onConflictDoUpdate({
					set: {
						defaultFileImageModelId: textModelRecordId,
						defaultSpeechToTextModelId: speechModelRecordId,
						defaultStandardSupportsAudio: false,
						defaultTextModelId: textModelRecordId,
						updatedAt: new Date(),
					},
					target: aiDefaults.id,
				});

			const strategy = await resolveGenerationStrategy(server.db, {
				hasAudio: true,
			});
			expect(strategy.generation.model.modelName).toBe("openrouter/test-text");
			expect(strategy.audio?.mode).toBe("preprocess");
			expect(
				strategy.audio?.mode === "preprocess" ? strategy.audio.selection.model.modelName : undefined,
			).toBe("openrouter/test-speech");
			expect(strategy.audio?.mode === "preprocess" ? strategy.audio.strategy : undefined).toBe(
				"direct",
			);

			await server.db
				.update(aiDefaults)
				.set({ defaultSpeechToTextMode: "multimodal" })
				.where(eq(aiDefaults.id, "global"));

			const promptedStrategy = await resolveGenerationStrategy(server.db, {
				hasAudio: true,
			});
			expect(
				promptedStrategy.audio?.mode === "preprocess" ? promptedStrategy.audio.strategy : undefined,
			).toBe("multimodal");
		} finally {
			await server.close();
		}
	});

	test("OpenRouter speech preprocessing uses the JSON transcription payload", async () => {
		const server = await startTestServer("openrouter-transcription-payload");
		const originalFetch = globalThis.fetch;
		try {
			const providerId = crypto.randomUUID();
			const speechModelRecordId = crypto.randomUUID();
			let requestBody: unknown;
			let requestContentType = "";
			let requestUrl = "";

			globalThis.fetch = ((input, init) => {
				requestUrl = String(input);
				requestContentType = new Headers(init?.headers).get("Content-Type") ?? "";
				requestBody = typeof init?.body === "string" ? JSON.parse(init.body) : null;
				return Promise.resolve(Response.json({ text: "Hallo Welt" }));
			}) as typeof fetch;

			await server.db.insert(aiProvider).values({
				apiKey: null,
				baseUrl: null,
				id: providerId,
				name: "OpenRouter",
				protocol: "openrouter",
			});
			await server.db.insert(aiModel).values({
				displayName: "Whisper Large v3",
				id: speechModelRecordId,
				modelId: "openai/whisper-large-v3",
				providerId,
				supportsReasoning: false,
			});
			await server.db
				.insert(aiDefaults)
				.values({
					defaultSpeechToTextModelId: speechModelRecordId,
					id: "global",
					updatedAt: new Date(),
				})
				.onConflictDoUpdate({
					set: {
						defaultSpeechToTextModelId: speechModelRecordId,
						updatedAt: new Date(),
					},
					target: aiDefaults.id,
				});

			const { user } = await createTestUser(server.db);
			const selection = await resolveDefaultModel(server.db, "speech-to-text");
			const result = await prepareAudioInputForModel({
				audioFiles: [
					{
						data: Buffer.from("audio").toString("base64"),
						mimeType: "audio/webm;codecs=opus",
					},
				],
				db: server.db,
				mode: "transcription",
				resolvedModel: selection.model,
				userId: user.id,
				zdr: false,
			});

			expect(result.transcripts).toEqual(["Hallo Welt"]);
			expect(requestUrl).toBe("https://openrouter.ai/api/v1/audio/transcriptions");
			expect(requestContentType).toBe("application/json");
			expect(requestBody).toEqual({
				input_audio: {
					data: Buffer.from("audio").toString("base64"),
					format: "webm",
				},
				model: "openai/whisper-large-v3",
			});
			const [event] = await server.db
				.select()
				.from(usageEvent)
				.where(eq(usageEvent.name, AI_SCRIBE_STT_EVENT_NAME));
			expect(event?.userId).toBe(user.id);
			expect(event?.metadata).toMatchObject({
				promptName: "stt:direct",
			});
		} finally {
			globalThis.fetch = originalFetch;
			await server.close();
		}
	});

	test("OpenAI-compatible speech preprocessing posts multipart form data", async () => {
		const server = await startTestServer("openai-compatible-transcription-payload");
		const originalFetch = globalThis.fetch;
		try {
			const providerId = crypto.randomUUID();
			const speechModelRecordId = crypto.randomUUID();
			let requestAuthorization = "";
			let requestBody: FormData | null = null;
			let requestUrl = "";

			globalThis.fetch = ((input, init) => {
				requestUrl = String(input);
				requestAuthorization = new Headers(init?.headers).get("Authorization") ?? "";
				requestBody = init?.body instanceof FormData ? init.body : null;
				return Promise.resolve(Response.json({ text: " Hallo Welt " }));
			}) as typeof fetch;

			await server.db.insert(aiProvider).values({
				apiKey: await encrypt("test-api-key"),
				baseUrl: "http://localhost:8000",
				id: providerId,
				name: "Local vLLM",
				protocol: "openai-compatible",
			});
			await server.db.insert(aiModel).values({
				displayName: "Whisper Large v3",
				id: speechModelRecordId,
				modelId: "whisper-large-v3",
				providerId,
				supportsReasoning: false,
			});
			await server.db
				.insert(aiDefaults)
				.values({
					defaultSpeechToTextModelId: speechModelRecordId,
					id: "global",
					updatedAt: new Date(),
				})
				.onConflictDoUpdate({
					set: {
						defaultSpeechToTextModelId: speechModelRecordId,
						updatedAt: new Date(),
					},
					target: aiDefaults.id,
				});

			const selection = await resolveDefaultModel(server.db, "speech-to-text");
			expect(selection.model.transcribeAudio).toBeDefined();

			const result = await prepareAudioInputForModel({
				audioFiles: [
					{
						data: Buffer.from("audio").toString("base64"),
						mimeType: "audio/webm;codecs=opus",
					},
				],
				mode: "transcription",
				resolvedModel: selection.model,
			});

			expect(result.transcripts).toEqual(["Hallo Welt"]);
			expect(requestUrl).toBe("http://localhost:8000/v1/audio/transcriptions");
			expect(requestAuthorization).toBe("Bearer test-api-key");
			const body = requestBody as FormData | null;
			expect(body).not.toBeNull();
			expect(body?.get("model")).toBe("whisper-large-v3");
			const file = body?.get("file");
			expect(file).toBeInstanceOf(File);
			expect((file as File).name).toBe("aufnahme-1.webm");
			expect((file as File).type).toBe("audio/webm");
		} finally {
			globalThis.fetch = originalFetch;
			await server.close();
		}
	});

	test("OpenAI-compatible transcription rejects empty transcription text", async () => {
		const server = await startTestServer("openai-compatible-transcription-empty");
		const originalFetch = globalThis.fetch;
		try {
			const providerId = crypto.randomUUID();
			const speechModelRecordId = crypto.randomUUID();

			globalThis.fetch = ((_input, _init) =>
				Promise.resolve(Response.json({ text: "   " }))) as typeof fetch;

			await server.db.insert(aiProvider).values({
				apiKey: null,
				baseUrl: "http://localhost:8000",
				id: providerId,
				name: "Local vLLM",
				protocol: "openai-compatible",
			});
			await server.db.insert(aiModel).values({
				displayName: "Whisper Large v3",
				id: speechModelRecordId,
				modelId: "whisper-large-v3",
				providerId,
				supportsReasoning: false,
			});
			await server.db
				.insert(aiDefaults)
				.values({
					defaultSpeechToTextModelId: speechModelRecordId,
					id: "global",
					updatedAt: new Date(),
				})
				.onConflictDoUpdate({
					set: {
						defaultSpeechToTextModelId: speechModelRecordId,
						updatedAt: new Date(),
					},
					target: aiDefaults.id,
				});

			const selection = await resolveDefaultModel(server.db, "speech-to-text");
			await expect(
				prepareAudioInputForModel({
					audioFiles: [
						{
							data: Buffer.from("audio").toString("base64"),
							mimeType: "audio/webm",
						},
					],
					mode: "transcription",
					resolvedModel: selection.model,
				}),
			).rejects.toThrow("Transkription lieferte keinen Text.");
		} finally {
			globalThis.fetch = originalFetch;
			await server.close();
		}
	});

	test("resolveDefaultModel throws when required default is missing", async () => {
		const server = await startTestServer("resolve-model-missing-default");
		try {
			const providerId = crypto.randomUUID();
			const textModelRecordId = crypto.randomUUID();

			await server.db.insert(aiProvider).values({
				apiKey: null,
				baseUrl: null,
				id: providerId,
				name: "Test Provider",
				protocol: "openrouter",
			});
			await server.db.insert(aiModel).values({
				displayName: "Text Model",
				id: textModelRecordId,
				modelId: "openrouter/test-text",
				providerId,
				supportsReasoning: false,
			});
			await server.db
				.insert(aiDefaults)
				.values({
					defaultFileImageModelId: textModelRecordId,
					defaultSpeechToTextModelId: null,
					defaultTextModelId: textModelRecordId,
					id: "global",
					updatedAt: new Date(),
				})
				.onConflictDoUpdate({
					set: {
						defaultFileImageModelId: textModelRecordId,
						defaultSpeechToTextModelId: null,
						defaultTextModelId: textModelRecordId,
						updatedAt: new Date(),
					},
					target: aiDefaults.id,
				});

			await expect(resolveDefaultModel(server.db, "speech-to-text")).rejects.toThrow(
				USER_MESSAGES.modelUnavailable,
			);
		} finally {
			await server.close();
		}
	});
});

const createResolvedModel = (overrides: Partial<ResolvedModel>): ResolvedModel => ({
	isOpenRouter: false,
	model: "test/model",
	modelName: "test/model",
	openRouterRoutingMode: "default",
	providerId: "provider-1",
	providerProtocol: "tinfoil",
	supportedParameters: [],
	supportsReasoning: true,
	...overrides,
});

describe("audio input preparation", () => {
	test("strips data URL envelopes before preparing native OpenRouter audio", async () => {
		const base64Audio = Buffer.from("audio").toString("base64");
		const result = await prepareAudioInputForModel({
			audioFiles: [
				{
					data: `data:audio/mp4;base64,${base64Audio}`,
					mimeType: "audio/mp4",
				},
			],
			mode: "native",
			resolvedModel: createResolvedModel({
				isOpenRouter: true,
				providerProtocol: "openrouter",
			}),
		});

		expect(result.contentParts).toHaveLength(1);
		expect(result.contentParts[0]?.data.toString()).toBe("audio");
		expect(result.contentParts[0]?.mediaType).toBe("audio/mp4");
	});

	test("rejects empty native audio before provider serialization", async () => {
		await expect(
			prepareAudioInputForModel({
				audioFiles: [
					{
						data: "data:audio/mp4;base64,",
						mimeType: "audio/mp4",
					},
				],
				mode: "native",
				resolvedModel: createResolvedModel({
					isOpenRouter: true,
					providerProtocol: "openrouter",
				}),
			}),
		).rejects.toThrow("Audioaufnahme 1 enthält keine Audiodaten.");
	});
});

describe("buildProviderOptions", () => {
	test("openrouter receives reasoning effort, user, usage and zdr", () => {
		const options = buildProviderOptions({
			includeUsage: true,
			model: createResolvedModel({ isOpenRouter: true, providerProtocol: "openrouter" }),
			reasoningEffort: "high",
			userId: "user-1",
			zdr: true,
		});

		expect(options).toEqual({
			openrouter: {
				reasoning: { effort: "high" },
				usage: { include: true },
				user: "user-1",
				zdr: true,
			},
		});
	});

	test.each([
		["nitro", "throughput"],
		["floor", "price"],
		["exacto", "exacto"],
	] as const)("sends %s routing mode as the %s provider sort", (openRouterRoutingMode, sort) => {
		const options = buildProviderOptions({
			model: createResolvedModel({
				isOpenRouter: true,
				openRouterRoutingMode,
				providerProtocol: "openrouter",
			}),
		});

		expect(options).toEqual({
			openrouter: { provider: { sort } },
		});
	});

	test("openai-compatible receives reasoning effort via openaiCompatible options", () => {
		const options = buildProviderOptions({
			model: createResolvedModel({ providerProtocol: "openai-compatible" }),
			reasoningEffort: "low",
		});

		expect(options).toEqual({
			openaiCompatible: {
				reasoningEffort: "low",
			},
		});
	});

	test("openai receives reasoning effort and user via openai options", () => {
		const options = buildProviderOptions({
			model: createResolvedModel({ providerProtocol: "openai" }),
			reasoningEffort: "xhigh",
			userId: "user-1",
		});

		expect(options).toEqual({
			openai: {
				reasoningEffort: "xhigh",
				user: "user-1",
			},
		});
	});

	test("anthropic maps reasoning effort to a thinking budget", () => {
		const options = buildProviderOptions({
			model: createResolvedModel({ providerProtocol: "anthropic" }),
			reasoningEffort: "medium",
		});

		expect(options).toEqual({
			anthropic: {
				thinking: { budgetTokens: 8192, type: "enabled" },
			},
		});
	});

	test("sends reasoning when support is unknown", () => {
		const options = buildProviderOptions({
			model: createResolvedModel({
				providerProtocol: "openai-compatible",
				supportedParameters: [],
				supportsReasoning: false,
			}),
			reasoningEffort: "high",
		});

		expect(options).toEqual({
			openaiCompatible: {
				reasoningEffort: "high",
			},
		});
	});

	test("omits reasoning when the model explicitly does not support it", () => {
		const options = buildProviderOptions({
			model: createResolvedModel({
				providerProtocol: "openai-compatible",
				supportedParameters: ["temperature"],
				supportsReasoning: false,
			}),
			reasoningEffort: "high",
		});

		expect(options).toBeUndefined();
	});

	test("omits reasoning when effort is none", () => {
		const options = buildProviderOptions({
			model: createResolvedModel({ providerProtocol: "anthropic" }),
			reasoningEffort: "none",
		});

		expect(options).toBeUndefined();
	});
});

describe("Fill Inputs Handler", () => {
	test("builds the autofill prompt around the shared context block", () => {
		const { contextXml } = composeScribeContext({
			formData: { diagnoseblock: "I50.1 Akute Linksherzinsuffizienz" },
		});
		const messages = composeFillInputsPrompt({ contextXml });

		expect(messages[1].content).toContain("<patient_context>");
		expect(messages[1].content).toContain("<diagnoseblock>");
		expect(messages[1].content).toContain("I50.1 Akute Linksherzinsuffizienz");
		expect(messages[1].content).not.toContain('"inputFields"');
		expect(messages[1].content).not.toContain("Verfügbare Felder");
	});

	test("allows text-only autofill through the default text model", async () => {
		const server = await startTestServer("fill-inputs-text-only");
		try {
			const providerId = crypto.randomUUID();
			const textModelRecordId = crypto.randomUUID();

			await server.db.insert(aiProvider).values({
				apiKey: null,
				baseUrl: null,
				id: providerId,
				name: "Test Provider",
				protocol: "openrouter",
			});
			await server.db.insert(aiModel).values([
				{
					displayName: "Text Model",
					id: textModelRecordId,
					modelId: "openrouter/test-text",
					providerId,
					supportsReasoning: false,
				},
			]);
			await server.db
				.insert(aiDefaults)
				.values({
					defaultFileImageModelId: textModelRecordId,
					defaultSpeechToTextModelId: null,
					defaultStandardSupportsAudio: true,
					defaultStandardSupportsDocuments: true,
					defaultTextModelId: textModelRecordId,
					id: "global",
					updatedAt: new Date(),
				})
				.onConflictDoUpdate({
					set: {
						defaultFileImageModelId: textModelRecordId,
						defaultSpeechToTextModelId: null,
						defaultStandardSupportsAudio: true,
						defaultStandardSupportsDocuments: true,
						defaultTextModelId: textModelRecordId,
						updatedAt: new Date(),
					},
					target: aiDefaults.id,
				});

			const { user } = await createTestUser(server.db);
			const context = createTestContext({
				db: server.db,
				session: createMockSession(user),
			});
			const result = await call(
				fillInputsHandler,
				{
					inputFields: [
						{
							label: "Aufnahmediagnose",
							type: "string",
						},
					],
					textContext: {
						diagnoseblock: "I50.1 Akute Linksherzinsuffizienz",
					},
				},
				{ context },
			);

			expect(result.fieldValues).toEqual({ test: "value" });

			const [event] = await server.db
				.select()
				.from(usageEvent)
				.where(eq(usageEvent.name, AI_INPUT_FILL_EVENT_NAME));
			expect(event?.userId).toBe(user.id);
			expect(event?.model).toBe("openrouter/test-text");
			expect(event?.inputData).toMatchObject({
				textContext: {
					diagnoseblock: "I50.1 Akute Linksherzinsuffizienz",
				},
			});
		} finally {
			await server.close();
		}
	});

	test("counts autofill cost against the monthly usage limit", async () => {
		const server = await startTestServer("fill-inputs-usage-limit");
		try {
			await createTestAiDefaults(server.db);
			const { user } = await createTestUser(server.db);

			await server.db.insert(usageEvent).values({
				cost: "2.00",
				id: crypto.randomUUID(),
				name: AI_INPUT_FILL_EVENT_NAME,
				timestamp: new Date(),
				userId: user.id,
			});

			await expect(
				call(
					fillInputsHandler,
					{
						inputFields: [{ label: "Aufnahmediagnose", type: "string" }],
						textContext: { diagnoseblock: "I50.1" },
					},
					{
						context: createTestContext({
							db: server.db,
							session: createMockSession(user),
						}),
					},
				),
			).rejects.toThrow("Monatliche Nutzungsgrenze erreicht");
		} finally {
			await server.close();
		}
	});

	test("rejects oversized autofill payloads before provider calls", async () => {
		const server = await startTestServer("fill-inputs-payload-limit");
		try {
			const { user } = await createTestUser(server.db);
			const data = Buffer.alloc(FILL_INPUT_PAYLOAD_LIMITS.maxContextFileBytes + 1).toString(
				"base64",
			);

			await expect(
				call(
					fillInputsHandler,
					{
						contextFiles: [
							{
								data,
								mimeType: "application/pdf",
								name: "zu-gross.pdf",
								size: FILL_INPUT_PAYLOAD_LIMITS.maxContextFileBytes + 1,
							},
						],
						inputFields: [{ label: "Patient", type: "string" }],
					},
					{
						context: createTestContext({
							db: server.db,
							session: createMockSession(user),
						}),
					},
				),
			).rejects.toThrow("zu-gross.pdf");
		} finally {
			await server.close();
		}
	});

	test("stores file metadata but not raw file bytes in autofill usage events", async () => {
		const server = await startTestServer("fill-inputs-file-metadata");
		try {
			await createTestAiDefaults(server.db);
			const { user } = await createTestUser(server.db);
			const rawFile = "geheime-datei-bytes";
			const fileData = Buffer.from(rawFile).toString("base64");
			const context = createTestContext({
				db: server.db,
				session: createMockSession(user),
			});

			await call(
				fillInputsHandler,
				{
					contextFiles: [
						{
							data: fileData,
							mimeType: "application/pdf",
							name: "befund.pdf",
							size: rawFile.length,
						},
					],
					inputFields: [{ label: "Befund", type: "string" }],
				},
				{ context },
			);

			const [event] = await server.db
				.select()
				.from(usageEvent)
				.where(eq(usageEvent.name, AI_INPUT_FILL_EVENT_NAME));
			const serializedInput = JSON.stringify(event?.inputData ?? {});
			expect(serializedInput).toContain("befund.pdf");
			expect(serializedInput).not.toContain(fileData);
			expect(serializedInput).not.toContain(rawFile);
			const [ocrEvent] = await server.db
				.select()
				.from(usageEvent)
				.where(eq(usageEvent.name, AI_SCRIBE_OCR_EVENT_NAME));
			expect(ocrEvent?.metadata).toMatchObject({
				promptName: "ocr:prompt",
			});
			const serializedOcrInput = JSON.stringify(ocrEvent?.inputData ?? {});
			expect(serializedOcrInput).toContain("befund.pdf");
			expect(serializedOcrInput).not.toContain(fileData);
			expect(serializedOcrInput).not.toContain(rawFile);
		} finally {
			await server.close();
		}
	});
});

describe("Scribe Agent section generation", () => {
	test("uses the normal scribe generation pipeline for an agent section", async () => {
		const server = await startTestServer("agent-generate-section-usage-input");
		try {
			await createTestAiDefaults(server.db);
			const { user } = await createTestUser(server.db);
			const session = createMockSession(user);
			const result = await call(
				scribeAgentGenerateSectionHandler,
				{
					documentType: "anamnese",
					formData: {
						befunde: "Basale Rasselgeräusche beidseits.",
						diagnoseblock: "I50.1 Akute Linksherzinsuffizienz",
						notes: "Bitte Anamnese aus Agentenhinweis erzeugen.",
					},
					preparedAttachmentText:
						"<audio_transkripte>\\n<aufnahme index=\"1\">\\nPatient berichtet seit gestern Belastungsdyspnoe.\\n</aufnahme>\\n</audio_transkripte>\\n\\nLabor: NT-proBNP deutlich erhöht.",
					source: "documentType",
					traceContext: { agentRunId: "agent-run-1", agentSectionId: "anamnese" },
				},
				{ context: { db: server.db, session } },
			);
			const content = result.text;

			expect(content).toBe("Generated text response");

			const [event] = await server.db
				.select()
				.from(usageEvent)
				.where(eq(usageEvent.name, "ai_scribe_generation"));

			expect(event?.metadata).toMatchObject({
				agentRunId: "agent-run-1",
				agentSectionId: "anamnese",
				endpoint: "anamnese",
				promptName: "anamnese",
			});
			const metadata = event?.metadata as Record<string, unknown> | undefined;
			const modelConfig = metadata?.modelConfig as Record<string, unknown> | undefined;
			expect(modelConfig).toBeDefined();
			expect(modelConfig).toHaveProperty("maxTokens", 8000);
			expect(event?.inputData).toMatchObject({
				befunde: "Basale Rasselgeräusche beidseits.",
				diagnoseblock: "I50.1 Akute Linksherzinsuffizienz",
			});
			const inputData = event?.inputData as Record<string, unknown> | undefined;
			const notes = String(inputData?.notes ?? "");
			expect(notes).toContain("Bitte Anamnese aus Agentenhinweis erzeugen.");
			expect(notes).toContain("Patient berichtet seit gestern Belastungsdyspnoe.");
			expect(notes).toContain("Labor: NT-proBNP deutlich erhöht.");
		} finally {
			await server.close();
		}
	});
});

/**
 * Integration tests for scribe streaming handler
 *
 * These tests use mocked AI SDK (streamText) to verify:
 * - Handler authentication and authorization
 * - Usage limit enforcement
 * - Subscription checks
 * - Input validation
 * - Error handling
 */
describe("Scribe Stream Handler", () => {
	let server: TestServer;

	beforeEach(async () => {
		server = await startTestServer("scribe-test");
		await createTestAiDefaults(server.db);
	});

	afterEach(async () => {
		await server?.close();
	});

	describe("Authentication & Authorization", () => {
		test("allows free-tier users without stripeCustomerId", async () => {
			const { user } = await createTestUser(server.db);
			const session = createMockSession({
				...user,
				stripeCustomerId: null,
			});
			const context = createTestContext({ db: server.db, session });

			const result = await call(
				scribeStreamHandler,
				{
					documentType: "discharge",
					messages: [
						{
							id: "1",
							parts: [{ text: '{"anamnese":"test"}', type: "text" as const }],
							role: "user" as const,
						},
					],
				},
				{ context },
			);

			expect(result).toBeDefined();
			expect(typeof result[Symbol.asyncIterator]).toBe("function");
		});
	});

	describe("Input Validation", () => {
		test("rejects unknown document type", async () => {
			const { user } = await createTestUser(server.db);
			const session = createMockSession(user);
			const context = createTestContext({ db: server.db, session });

			await expect(
				call(
					scribeStreamHandler,
					{
						documentType: "unknown-type" as DocumentType,
						messages: [
							{
								id: "1",
								parts: [{ text: "{}", type: "text" as const }],
								role: "user" as const,
							},
						],
					},
					{ context },
				),
			).rejects.toThrow(ORPCError);
		});

		test("rejects empty prompt input with helpful message", async () => {
			const { user } = await createTestUser(server.db);
			const session = createMockSession(user);
			const context = createTestContext({ db: server.db, session });

			await expect(
				call(
					scribeStreamHandler,
					{
						documentType: "anamnese",
						messages: [
							{
								id: "1",
								parts: [
									{
										text: JSON.stringify({
											befunde: "",
											diagnoseblock: "",
											notes: "",
										}),
										type: "text" as const,
									},
								],
								role: "user" as const,
							},
						],
					},
					{ context },
				),
			).rejects.toThrow("Bitte füllen Sie mindestens ein Pflichtfeld aus.");
		});

		test("accepts valid document types", async () => {
			const { user } = await createTestUser(server.db);
			const session = createMockSession(user);
			const context = createTestContext({ db: server.db, session });

			const validTypes: DocumentType[] = ["discharge", "anamnese", "diagnosis"];

			for (const docType of validTypes) {
				// Should not throw for valid types
				// Note: May still fail on usage limits, but not on validation
				try {
					await call(
						scribeStreamHandler,
						{
							documentType: docType,
							messages: [
								{
									id: "1",
									parts: [{ text: '{"notes":"test"}', type: "text" as const }],
									role: "user" as const,
								},
							],
						},
						{ context },
					);
				} catch (error) {
					// Only usage limit errors are acceptable here
					if (error instanceof ORPCError) {
						expect(error.code).not.toBe("BAD_REQUEST");
					}
				}
			}
		});
	});

	describe("Usage Limits", () => {
		test("enforces free tier monthly cost limit", async () => {
			const { user } = await createTestUser(server.db);

			// Free tier budget is $2/month.
			const { usageEvent: usageEventTable } = await import("@repo/database");
			await server.db.insert(usageEventTable).values({
				cost: "2.00",
				id: crypto.randomUUID(),
				name: "admin_scribe_playground",
				timestamp: new Date(),
				userId: user.id,
			});

			const session = createMockSession(user);
			const context = createTestContext({ db: server.db, session });

			await expect(
				call(
					scribeStreamHandler,
					{
						documentType: "discharge",
						messages: [
							{
								id: "1",
								parts: [{ text: '{"anamnese":"test"}', type: "text" as const }],
								role: "user" as const,
							},
						],
					},
					{ context },
				),
			).rejects.toThrow("Monatliche Nutzungsgrenze erreicht");
		});

		test("plus subscribers have a higher monthly cost limit", async () => {
			const { user } = await createTestUser(server.db);

			// Create active subscription
			await createTestSubscription(server.db, user.id, {
				plan: "plus",
				status: "active",
			});

			// Free-tier budget is exhausted, but Plus still has room.
			const { usageEvent: usageEventTable } = await import("@repo/database");
			await server.db.insert(usageEventTable).values({
				cost: "2.00",
				id: crypto.randomUUID(),
				name: "ai_scribe_generation",
				timestamp: new Date(),
				userId: user.id,
			});

			const session = createMockSession(user);
			const context = createTestContext({ db: server.db, session });

			// Should not throw - under plus cost budget
			// Note: Will still return a stream (mocked)
			const result = await call(
				scribeStreamHandler,
				{
					documentType: "discharge",
					messages: [
						{
							id: "1",
							parts: [
								{
									text: JSON.stringify({
										anamnese: "test",
										befunde: "test",
										diagnoseblock: "test",
										notes: "test",
									}),
									type: "text" as const,
								},
							],
							role: "user" as const,
						},
					],
				},
				{ context },
			);

			// Should return an async iterator (stream)
			expect(result).toBeDefined();
			expect(typeof result[Symbol.asyncIterator]).toBe("function");
		});

		test("plus subscribers hit the monthly cost limit", async () => {
			const { user } = await createTestUser(server.db);

			// Create active subscription
			await createTestSubscription(server.db, user.id, {
				plan: "plus",
				status: "active",
			});

			// Plus budget is $8/month.
			const { usageEvent: usageEventTable } = await import("@repo/database");
			await server.db.insert(usageEventTable).values({
				cost: "8.00",
				id: crypto.randomUUID(),
				name: "ai_scribe_generation",
				timestamp: new Date(),
				userId: user.id,
			});

			const session = createMockSession(user);
			const context = createTestContext({ db: server.db, session });

			await expect(
				call(
					scribeStreamHandler,
					{
						documentType: "discharge",
						messages: [
							{
								id: "1",
								parts: [{ text: '{"anamnese":"test"}', type: "text" as const }],
								role: "user" as const,
							},
						],
					},
					{ context },
				),
			).rejects.toThrow("Monatliche Nutzungsgrenze erreicht");
		});
	});

	describe("Streaming Response", () => {
		test("returns async iterator for valid request", async () => {
			const { user } = await createTestUser(server.db);
			const session = createMockSession(user);
			const context = createTestContext({ db: server.db, session });

			const result = await call(
				scribeStreamHandler,
				{
					documentType: "anamnese",
					messages: [
						{
							id: "1",
							parts: [
								{
									text: JSON.stringify({
										befunde: "ECG normal",
										diagnoseblock: "Hypertension",
										notes: "Patient with chest pain",
									}),
									type: "text" as const,
								},
							],
							role: "user" as const,
						},
					],
				},
				{ context },
			);

			expect(result).toBeDefined();
			// The result should be an async iterator
			expect(typeof result[Symbol.asyncIterator]).toBe("function");
		});

		test("resolves admin-configured default model", async () => {
			const { user } = await createTestUser(server.db);
			const session = createMockSession(user);
			const context = createTestContext({ db: server.db, session });

			const result = await call(
				scribeStreamHandler,
				{
					documentType: "anamnese" as const,
					messages: [
						{
							id: "1",
							parts: [
								{
									text: JSON.stringify({
										befunde: "",
										diagnoseblock: "",
										notes: "test",
									}),
									type: "text" as const,
								},
							],
							role: "user" as const,
						},
					],
				},
				{ context },
			);
			expect(result).toBeDefined();
		});
	});
});
