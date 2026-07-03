import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { call } from "@orpc/server";
import {
	aiDefaults,
	aiModel,
	aiProvider,
	eq,
	usageEvent,
} from "@repo/database";
import { scribeHandler } from "@/orpc/admin/scribe";
import { documentsHandler } from "@/orpc/documents";
import {
	ADMIN_EMAIL,
	createTestAiDefaults,
	createTestContext,
	createTestUser,
	startTestServer,
} from "@/__tests__/setup";
import type { TestServer } from "@/__tests__/setup";
import { ocrToMarkdownHandler } from "@/orpc/scribe/handlers/ocr-to-markdown";
import { appendScribeInputAttachmentsToMessages } from "@/orpc/scribe/handlers/scribe-stream";
import type { ResolvedGenerationStrategy } from "@/orpc/scribe/handlers/scribe-stream";
import type { ResolvedModel } from "@/orpc/scribe/providers";

describe("Shared Resolver Usage (admin/documents)", () => {
	let server: TestServer;
	let context: ReturnType<typeof createTestContext>;
	let seeded: Awaited<ReturnType<typeof createTestAiDefaults>>;

	beforeEach(async () => {
		server = await startTestServer("admin-documents-resolution");
		const { session } = await createTestUser(server.db, { email: ADMIN_EMAIL });
		context = createTestContext({ db: server.db, session });
		seeded = await createTestAiDefaults(server.db);
	});

	afterEach(async () => {
		await server?.close();
	});

	test("admin.scribe.run resolves model via providerId + modelId", async () => {
		const result = await call(
			scribeHandler.run,
			{
				compiledMessagesOverride: [
					{
						content: "test",
						role: "user",
					},
				],
				documentType: "anamnese",
				model: seeded.modelId,
				parameters: {
					maxTokens: 512,
					reasoningEffort: "medium",
					temperature: 0.7,
					thinking: true,
					thinkingExplicit: true,
				},
				providerId: seeded.providerId,
				requestId: "req-1",
			},
			{ context },
		);

		expect(result).toBeDefined();
		expect(typeof result[Symbol.asyncIterator]).toBe("function");

		let streamedChunkCount = 0;
		for await (const _chunk of result) {
			streamedChunkCount += 1;
		}
		expect(streamedChunkCount).toBeGreaterThanOrEqual(0);
		await Bun.sleep(80);

		const [playgroundEvent] = await server.db
			.select()
			.from(usageEvent)
			.where(eq(usageEvent.name, "admin_scribe_playground"));
		expect(playgroundEvent).toBeUndefined();
	});

	test("shared attachment flow adds audio and context file parts", async () => {
		const resolvedModel: ResolvedModel = {
			isOpenRouter: true,
			model: {} as ResolvedModel["model"],
			modelName: seeded.modelId,
			openRouterRoutingMode: "default",
			providerId: seeded.providerId,
			providerProtocol: "openrouter",
			supportedParameters: [],
			supportsReasoning: false,
		};
		const generationStrategy: ResolvedGenerationStrategy = {
			audio: { mode: "native" },
			files: { mode: "native" },
			generation: {
				defaultTemperature: null,
				model: resolvedModel,
				reasoningEffort: "none",
				slot: "text",
			},
		};

		const { messages: resultMessages } = await appendScribeInputAttachmentsToMessages({
			audioFiles: [
				{
					data: Buffer.from("webm-audio").toString("base64"),
					mimeType: "audio/webm;codecs=opus",
					wavFallback: {
						data: Buffer.from("wav-audio").toString("base64"),
						mimeType: "audio/wav",
					},
				},
			],
			contextFiles: [
				{
					data: Buffer.from("pdf-bytes").toString("base64"),
					mimeType: "application/pdf",
					name: "befund.pdf",
					size: 9,
				},
			],
			db: server.db,
			generationStrategy,
			messages: [{ content: "Bitte auswerten", role: "user" }],
			userId: context.session?.user.id ?? "test-user",
			zdr: false,
		});

		const content = resultMessages.at(-1)?.content;
		expect(Array.isArray(content)).toBe(true);
		const parts = content as { mediaType?: string; text?: string; type: string }[];
		expect(
			parts.some((part) => part.type === "text" && part.text?.includes("<audio_context>")),
		).toBe(true);
		expect(parts.some((part) => part.type === "file" && part.mediaType === "audio/wav")).toBe(
			true,
		);
		expect(
			parts.some((part) => part.type === "file" && part.mediaType === "application/pdf"),
		).toBe(true);
		expect(parts.some((part) => part.type === "text" && part.text?.includes("befund.pdf"))).toBe(
			true,
		);
	});

	test("admin.scribe.run accepts context files in the playground payload", async () => {
		const result = await call(
			scribeHandler.run,
			{
				compiledMessagesOverride: [
					{
						content: "test",
						role: "user",
					},
				],
				contextFiles: [
					{
						data: Buffer.from("pdf-bytes").toString("base64"),
						mimeType: "application/pdf",
						name: "befund.pdf",
						size: 9,
					},
				],
				documentType: "anamnese",
				model: seeded.modelRecordId,
				parameters: {
					maxTokens: 512,
					reasoningEffort: "none",
					temperature: 0.7,
					thinking: false,
					thinkingExplicit: false,
				},
				requestId: "req-files",
			},
			{ context },
		);

		expect(result).toBeDefined();
		expect(typeof result[Symbol.asyncIterator]).toBe("function");
	});

	test("admin.scribe.run sends audio natively to the selected playground model", async () => {
		const originalFetch = globalThis.fetch;
		try {
			globalThis.fetch = (() => {
				throw new Error("Playground audio should not call transcription fetch");
			}) as unknown as typeof fetch;

			const result = await call(
				scribeHandler.run,
				{
					audioFiles: [
						{
							data: Buffer.from("webm-audio").toString("base64"),
							mimeType: "audio/webm;codecs=opus",
							wavFallback: {
								data: Buffer.from("wav-audio").toString("base64"),
								mimeType: "audio/wav",
							},
						},
					],
					compiledMessagesOverride: [
						{
							content: "test",
							role: "user",
						},
					],
					documentType: "anamnese",
					model: seeded.modelRecordId,
					parameters: {
						maxTokens: 512,
						reasoningEffort: "none",
						temperature: 0.7,
						thinking: false,
						thinkingExplicit: false,
					},
					requestId: "req-audio",
				},
				{ context },
			);

			expect(result).toBeDefined();
			expect(typeof result[Symbol.asyncIterator]).toBe("function");
		} finally {
			globalThis.fetch = originalFetch;
		}
	});

	test("scribe.ocrToMarkdown resolves model via legacy connectionId alias", async () => {
		const imageBase64 = Buffer.from("fake-image").toString("base64");

		const result = await call(
			ocrToMarkdownHandler,
			{
				connectionId: seeded.providerId,
				imagesBase64: [imageBase64],
				model: seeded.modelId,
			},
			{ context },
		);

		expect(result.markdown).toBe("Generated text response");
	});

	test("scribe.ocrToMarkdown accepts explicit image media types", async () => {
		const result = await call(
			ocrToMarkdownHandler,
			{
				images: [
					{
						data: Buffer.from("fake-png").toString("base64"),
						mediaType: "image/png",
					},
				],
				model: seeded.modelId,
				providerId: seeded.providerId,
			},
			{ context },
		);

		expect(result.markdown).toBe("Generated text response");
	});

	test("documents.parseForm resolves file/image default model", async () => {
		const providerId = crypto.randomUUID();
		const textModelRecordId = crypto.randomUUID();
		const fileModelRecordId = crypto.randomUUID();

		await server.db.insert(aiProvider).values({
			apiKey: null,
			baseUrl: null,
			id: providerId,
			name: "OCR Provider",
			protocol: "openrouter",
		});
		await server.db.insert(aiModel).values([
			{
				displayName: "Text Model",
				id: textModelRecordId,
				modelId: "openrouter/text-model",
				providerId,
				supportsReasoning: false,
			},
			{
				displayName: "File Model",
				id: fileModelRecordId,
				modelId: "openrouter/file-model",
				providerId,
				supportsReasoning: false,
			},
		]);
		await server.db
			.insert(aiDefaults)
			.values({
				defaultFileImageModelId: fileModelRecordId,
				defaultSpeechToTextModelId: textModelRecordId,
				defaultTextModelId: textModelRecordId,
				id: "global",
				updatedAt: new Date(),
			})
			.onConflictDoUpdate({
				set: {
					defaultFileImageModelId: fileModelRecordId,
					defaultSpeechToTextModelId: textModelRecordId,
					defaultTextModelId: textModelRecordId,
					updatedAt: new Date(),
				},
				target: aiDefaults.id,
			});

		const result = await call(
			documentsHandler.parseForm,
			{
				fieldMapping: [],
				fileBase64: Buffer.from("fake-pdf").toString("base64"),
			},
			{ context },
		);
		expect(result).toBeDefined();

		const [logged] = await server.db
			.select()
			.from(usageEvent)
			.where(eq(usageEvent.name, "ai_pdf_form_parsing"));
		expect(logged?.model).toBe("openrouter/file-model");
	});

	test("documents.parseForm resolves explicit playground model selection", async () => {
		const selectedModelRecordId = crypto.randomUUID();
		const selectedModelId = "openrouter/document-playground-model";

		await server.db.insert(aiModel).values({
			displayName: "Document Playground Model",
			id: selectedModelRecordId,
			modelId: selectedModelId,
			providerId: seeded.providerId,
			supportsReasoning: false,
		});

		const result = await call(
			documentsHandler.parseForm,
			{
				fieldMapping: [],
				fileBase64: Buffer.from("fake-pdf").toString("base64"),
				model: selectedModelId,
				providerId: seeded.providerId,
			},
			{ context },
		);
		expect(result).toBeDefined();

		const [logged] = await server.db
			.select()
			.from(usageEvent)
			.where(eq(usageEvent.name, "ai_pdf_form_parsing"));
		expect(logged?.model).toBe(selectedModelId);
	});
});
