import { expect, spyOn, test } from "bun:test";

import { call } from "@orpc/server";
import { aiDefaults, aiModel, aiProvider, eq, usageEvent } from "@repo/database";
import sharp from "sharp";
import { z } from "zod";

import { aiMockState, ocrMockState } from "@/__tests__/preload";
import {
	createTestAiDefaults,
	createTestContext,
	createTestUser,
	startTestServer,
} from "@/__tests__/setup";
import { FILL_INPUT_PAYLOAD_LIMITS } from "@/lib/input-fill-limits";
import type { OcrContextDocument, OcrResult } from "@/lib/ocr-types";
import { AI_INPUT_FILL_EVENT_NAME, AI_SCRIBE_OCR_EVENT_NAME } from "@/lib/usage-event-names";
import { prepareAgentMedia } from "@/orpc/scribe-agent/lib/prepare-media";
import { extractContextFiles } from "@/orpc/scribe/handlers/context-file-input";
import {
	documentInputPolicyHandler,
	extractContextFileHandler,
} from "@/orpc/scribe/handlers/extract-context-file";
import { fillInputsHandler } from "@/orpc/scribe/handlers/fill-inputs";
import { appendScribeInputAttachmentsToMessages } from "@/orpc/scribe/handlers/scribe-stream";
import {
	resolveAgentGenerationStrategy,
	resolveGenerationStrategy,
	resolveOcrSelection,
} from "@/orpc/scribe/providers";
import type { ResolvedOcrServiceSelection } from "@/orpc/scribe/providers";

const image = await sharp({ create: { background: "white", channels: 3, height: 64, width: 64 } })
	.png()
	.toBuffer();
const file = {
	data: image.toString("base64"),
	mimeType: "image/png",
	name: "scan.png",
	size: image.length,
};

test("native vision is used only without a selected document model", async () => {
	const server = await startTestServer("native-preview-ocr");
	try {
		const { modelRecordId } = await createTestAiDefaults(server.db);
		const { session } = await createTestUser(server.db);
		const context = createTestContext({ db: server.db, session });
		for (const ocrModelId of [null, modelRecordId]) {
			await server.db
				.update(aiDefaults)
				.set({
					defaultFileImageModelId: ocrModelId,
					defaultStandardSupportsDocuments: true,
				})
				.where(eq(aiDefaults.id, "global"));
			expect(await call(documentInputPolicyHandler, undefined, { context })).toMatchObject({
				ocrConfigured: ocrModelId !== null,
				supportsDocuments: true,
			});
			ocrMockState.error = new Error("preview OCR unavailable");
			aiMockState.nextGenerateTextOutput = {
				suggestions: [{ citations: [{ quote: "Age 42", source: 2 }], field: "Age", value: 42 }],
			};
			const request = call(
				fillInputsHandler,
				{
					contextFiles: [{ ...file, id: "native", mimeType: "application/pdf" }],
					inputFields: [{ label: "Age", type: "number" }],
					textContext: { notes: "Native report" },
				},
				{ context },
			);
			if (ocrModelId !== null) {
				await expect(request).rejects.toThrow("preview OCR unavailable");
				continue;
			}
			const result = await request;
			// Native generation succeeds before the optional evidence phase hits the OCR error.
			expect(result.suggestions).toEqual({ Age: { value: 42 } });
			expect(result.citationError).toBe(true);
			expect(result.ocrResults).toEqual([]);
			const options = aiMockState.lastGenerateTextOptions as { messages: { content: unknown }[] };
			expect(JSON.stringify(options.messages)).not.toContain("mdscribe://");
			expect(JSON.stringify(options.messages)).toContain('\\"source\\":2');
			expect(options.messages[1].content).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						data: image,
						mediaType: "application/pdf",
						type: "file",
					}),
				]),
			);
		}
		await server.db
			.update(aiDefaults)
			.set({
				defaultAgentSupportsDocuments: true,
				defaultStandardSupportsAgent: false,
				defaultStandardSupportsDocuments: false,
			})
			.where(eq(aiDefaults.id, "global"));
		// A separate agent model can read documents natively even when the standard model cannot.
		expect(await call(documentInputPolicyHandler, undefined, { context })).toMatchObject({
			agentSupportsDocuments: true,
			ocrConfigured: true,
			supportsDocuments: false,
		});
		await expect(
			call(
				fillInputsHandler,
				{
					contextFiles: [{ ...file, mimeType: "application/pdf" }],
					inputFields: [{ label: "Age", type: "number" }],
				},
				{ context },
			),
		).rejects.toThrow("preview OCR unavailable");
	} finally {
		delete ocrMockState.error;
		await server.close();
	}
});

test("upload OCR uses the OCR slot and every generation consumer reuses the unsigned result without bytes", async () => {
	const server = await startTestServer("immediate-ocr");
	let calls = 0;
	const endpoint = Bun.serve({
		fetch: () => {
			calls += 1;
			if (calls > 1) {
				return new Response(null, { status: 503 });
			}
			return Response.json({
				results: [{ bbox: [1, 2, 30, 20], confidence: 0.9, text: "Recognized" }],
				text: "Recognized",
			});
		},
		hostname: "127.0.0.1",
		port: 0,
	});
	try {
		const { session, user } = await createTestUser(server.db);
		const context = createTestContext({ db: server.db, session });
		await server.db.insert(aiProvider).values({
			baseUrl: `${endpoint.url}ocr`,
			id: "paddle",
			name: "Paddle",
			protocol: "ocr-http",
		});
		await server.db
			.insert(aiModel)
			.values({ displayName: "OCR", id: "paddle-model", modelId: "ocr", providerId: "paddle" });
		await createTestAiDefaults(server.db);
		await server.db
			.update(aiDefaults)
			.set({
				defaultFileImageModelId: "paddle-model",
				defaultStandardSupportsAgent: true,
				defaultStandardSupportsDocuments: true,
			})
			.where(eq(aiDefaults.id, "global"));
		delete ocrMockState.config;
		ocrMockState.error = new Error("images must bypass the PDF renderer");
		const uploaded = await call(extractContextFileHandler, { file }, { context });
		expect(uploaded.result.text).toBe("Recognized");
		expect(uploaded.result.backend).toBe("ocr-http");
		expect(Object.keys(uploaded)).toEqual(["result"]);
		expect(ocrMockState.config).toBeUndefined();
		// Browser submissions carry only text/geometry even for vision-capable generators.
		const document: OcrContextDocument = {
			kind: "ocr",
			name: file.name,
			ocrResult: uploaded.result,
		};
		const reused = await extractContextFiles({
			contextFiles: [document],
			db: server.db,
			modelSelection: await resolveOcrSelection(server.db, user.id),
			userId: user.id,
		});
		expect(reused.ocrResults).toEqual([uploaded.result]);
		expect(calls).toBe(1);
		expect(reused.textContext).toBe(
			`<datei_kontext>\n${JSON.stringify([{ index: 1, name: "scan.png", text: "Recognized" }])}\n</datei_kontext>`,
		);
		const secondResult: OcrResult = {
			backend: "ocr-http",
			pages: [
				{
					blocks: [{ bbox: { height: 19, width: 82, x: 11, y: 45 }, text: "Second" }],
					height: 700,
					pageNumber: 2,
					width: 400,
				},
			],
			text: "Second",
		};
		const citations = [
			{ quote: "Recognized", source: "mdscribe://file/first" },
			{ quote: "History", source: "mdscribe://input/anamnese" },
			{ quote: "Second", source: "mdscribe://file/second" },
		];
		const suggestions = {
			Finding: { citations, value: "Recognized / History / Second" },
		};
		const fillInput = {
			contextFiles: [
				{ ...document, id: "first" },
				{ ...document, id: "second", ocrResult: secondResult },
			],
			inputFields: [
				{ label: "Age", type: "number" as const },
				{ label: "Finding", type: "string" as const },
				...Array.from({ length: 28 }, (_, index) => ({
					label: `Additional field ${index + 1}`,
					type: "string" as const,
				})),
			],
			textContext: { anamnese: "History", notes: " " },
		};
		aiMockState.nextGenerateTextOutput = {
			suggestions: [{ field: "Finding", value: suggestions.Finding.value }],
		};
		aiMockState.nextCitationOutput = { annotations: [{ field: "Finding", passages: [2, 1, 3] }] };
		const filled = await call(fillInputsHandler, fillInput, { context });
		expect(filled.suggestions).toEqual(suggestions);
		expect(filled.ocrResults).toEqual([uploaded.result, secondResult]);
		const fillOptions = aiMockState.lastGenerateTextOptions as {
			messages: { content: unknown }[];
			output: { schema: z.ZodType };
		};
		// Repeated constrained citations caused Google AI Studio to reject 30-field forms.
		const providerSchema = JSON.stringify(z.toJSONSchema(fillOptions.output.schema));
		for (const constraint of ["minLength", "maxLength", "minItems", "maxItems", "enum"]) {
			expect(providerSchema).not.toContain(`"${constraint}"`);
		}
		// Numbers belong to this request, not filenames or a previous request's ordering.
		aiMockState.nextGenerateTextOutput = {
			suggestions: [{ field: "Finding", value: "Second" }],
		};
		aiMockState.nextCitationOutput = { annotations: [{ field: "Finding", passages: [1] }] };
		const reordered = await call(
			fillInputsHandler,
			{
				...fillInput,
				contextFiles: fillInput.contextFiles.toReversed(),
				textContext: {},
			},
			{ context },
		);
		expect(reordered.suggestions).toEqual({
			Finding: { citations: [citations[2]], value: "Second" },
		});
		// Value constraints still apply independently of whether evidence is available.
		for (const invalidSuggestions of [
			[{ field: "Unsubmitted", value: "text" }],
			[{ field: "Finding", value: true }],
			[
				{ field: "Age", value: 42 },
				{ field: "Age", value: 43 },
			],
		]) {
			aiMockState.nextGenerateTextOutput = { suggestions: invalidSuggestions };
			await expect(call(fillInputsHandler, fillInput, { context })).rejects.toThrow(
				"Die Modellantwort entspricht nicht dem erwarteten Schema",
			);
		}
		expect(typeof fillOptions.messages[1].content).toBe("string");
		const contextJson = String(fillOptions.messages[1].content).match(
			/<datei_kontext>\n(.*?)\n<\/datei_kontext>/s,
		)?.[1];
		expect(JSON.parse(contextJson ?? "null")).toEqual([
			{
				index: 1,
				name: file.name,
				source: 2,
				text: "Recognized",
			},
			{
				index: 2,
				name: file.name,
				source: 3,
				text: "Second",
			},
		]);
		expect(JSON.stringify(fillOptions.messages)).not.toContain("mdscribe://");
		expect(fillOptions.messages[1].content).not.toContain('"bbox"');
		expect(fillOptions.messages[1].content).not.toContain('"pages"');
		expect(fillOptions.messages[1].content).not.toContain('"ocrResult"');
		expect(fillOptions.messages[1].content).not.toContain(file.data);
		expect(fillOptions.messages[1].content).not.toContain("ocrResultToken");
		const fileSummaries = [
			{
				index: 1,
				name: "scan.png",
				payloadBytes: Buffer.byteLength(JSON.stringify(fillInput.contextFiles[0])),
			},
			{
				index: 2,
				name: "scan.png",
				payloadBytes: Buffer.byteLength(JSON.stringify(fillInput.contextFiles[1])),
			},
		];
		const events = await server.db.select().from(usageEvent);
		const fillEvent = events.find((event) => event.name === AI_INPUT_FILL_EVENT_NAME);
		expect(fillEvent).toHaveProperty("inputData.contextFiles", fileSummaries);
		expect(fillEvent).toHaveProperty("metadata.payloadSummary.contextFiles", fileSummaries);
		const ocrEvent = events.find((event) => event.name === AI_SCRIBE_OCR_EVENT_NAME);
		expect(ocrEvent?.inputData).toEqual({
			contextFiles: [
				{
					index: 1,
					mediaType: "image/png",
					name: "scan.png",
					payloadBytes: image.length,
					size: image.length,
				},
			],
		});
		const standard = await resolveGenerationStrategy(server.db, {
			hasFiles: true,
			userId: user.id,
		});
		expect(standard.files?.mode).toBe("preprocess");
		const attached = await appendScribeInputAttachmentsToMessages({
			audioFiles: [],
			contextFiles: [document],
			db: server.db,
			generationStrategy: standard,
			messages: [{ content: "Generate", role: "user" }],
			userId: user.id,
			zdr: true,
		});
		expect(attached.messages[0].content).toContain(reused.textContext);
		const agent = await resolveAgentGenerationStrategy(server.db, {
			hasFiles: true,
			userId: user.id,
		});
		expect(agent.files?.mode).toBe("preprocess");
		const prepared = await prepareAgentMedia({
			audioFiles: [],
			contextFiles: [document],
			db: server.db,
			strategy: agent,
			userId: user.id,
			zdr: true,
		});
		expect(prepared.nativeContentParts).toEqual([]);
		expect(prepared.fileTextContext).toBe(reused.textContext);
		expect(prepared.fileSummaries).toEqual([
			{ index: 1, name: "scan.png", payloadBytes: Buffer.byteLength(JSON.stringify(document)) },
		]);
		expect(calls).toBe(1);
		// OCR context is user-provided data, like any other text context, not authenticated provenance.
		const edited = await extractContextFiles({
			contextFiles: [{ ...document, ocrResult: { ...document.ocrResult, text: "User context" } }],
			modelSelection: await resolveOcrSelection(server.db, user.id),
			userId: user.id,
		});
		expect(edited.ocrResults[0].text).toBe("User context");
		expect(calls).toBe(1);
		// Raw/internal callers still request extraction and surface actual provider failures.
		await expect(
			extractContextFiles({
				contextFiles: [file],
				modelSelection: await resolveOcrSelection(server.db, user.id),
				userId: user.id,
			}),
		).rejects.toThrow("Die OCR-Service-Anfrage ist fehlgeschlagen.");
		expect(calls).toBe(2);
	} finally {
		endpoint.stop(true);
		delete ocrMockState.error;
		delete ocrMockState.result;
		await server.close();
	}
});

test("upload OCR rejects unauthenticated, unsupported, malformed and oversized requests before parsing", async () => {
	const server = await startTestServer("immediate-ocr-validation");
	try {
		const { session } = await createTestUser(server.db);
		const context = createTestContext({ db: server.db, session });
		await expect(
			call(extractContextFileHandler, { file }, { context: createTestContext({ db: server.db }) }),
		).rejects.toThrow();
		await expect(
			call(extractContextFileHandler, { file: { ...file, mimeType: "text/html" } }, { context }),
		).rejects.toThrow("Nur Bilder");
		await expect(
			call(extractContextFileHandler, { file: { ...file, data: "" } }, { context }),
		).rejects.toThrow("Nur Bilder");
		const oversized = "a".repeat(
			Math.ceil((FILL_INPUT_PAYLOAD_LIMITS.maxContextFileBytes * 4) / 3) + 4,
		);
		await expect(
			call(extractContextFileHandler, { file: { ...file, data: oversized } }, { context }),
		).rejects.toThrow("zu groß");
	} finally {
		await server.close();
	}
});

test.each(["elapsed-time", "model-change"])(
	"generation preserves submitted OCR text and boxes without another provider request (%s)",
	async (reason) => {
		let calls = 0;
		const endpoint = Bun.serve({
			fetch: () => {
				calls += 1;
				return new Response(null, { status: 503 });
			},
			hostname: "127.0.0.1",
			port: 0,
		});
		const result: OcrResult = {
			backend: "ocr-http",
			pages: [
				{
					blocks: [{ bbox: { height: 11, width: 13, x: 3, y: 7 }, text: "5 mg" }],
					height: 64,
					pageNumber: 1,
					width: 64,
				},
			],
			text: '# Dosis\n\n<table><tr><td rowspan="2" colspan="3">5 mg</td></tr></table>\n\n[x] Ja',
		};
		const document: OcrContextDocument = {
			kind: "ocr",
			name: file.name,
			ocrResult: result,
		};
		const clock = spyOn(Date, "now");
		try {
			const selection: ResolvedOcrServiceSelection = {
				kind: "ocr-service",
				model: {
					credentialSource: "operator",
					endpoint: `${endpoint.url}ocr`,
					modelName: "previous/ocr",
					providerId: "previous",
					providerProtocol: "ocr-http",
				},
				slot: "file-image",
			};
			const initial = await extractContextFiles({
				contextFiles: [document],
				modelSelection: selection,
				userId: "test-user",
			});
			if (reason === "elapsed-time") {
				clock.mockReturnValue(Date.now() + 24 * 60 * 60_000);
			} else {
				selection.model = {
					...selection.model,
					modelName: "new/ocr",
					providerId: "new-provider",
					providerProtocol: "mistral-ocr",
				};
			}
			const generated = await extractContextFiles({
				contextFiles: [document],
				modelSelection: selection,
				userId: "test-user",
			});
			expect(calls).toBe(0);
			expect(generated).toEqual(initial);
			expect(generated.ocrResults).toEqual([result]);
			const [promptDocument] = JSON.parse(generated.textContext.split("\n")[1]);
			expect(Object.keys(promptDocument)).toEqual(["index", "name", "text"]);
			expect(promptDocument.text).toContain("5 mg");
			expect(promptDocument.text).toContain("[x] Ja");
			expect(promptDocument.text).not.toContain("<table>");
		} finally {
			clock.mockRestore();
			endpoint.stop(true);
		}
	},
);

test("submitted OCR rejects malformed structure and attached image bytes; blank and text-only results remain valid", async () => {
	const selection: ResolvedOcrServiceSelection = {
		kind: "ocr-service",
		model: {
			credentialSource: "operator",
			endpoint: "http://127.0.0.1:1/ocr",
			modelName: "unused",
			providerId: "unused",
			providerProtocol: "ocr-http",
		},
		slot: "file-image",
	};
	const document: OcrContextDocument = {
		kind: "ocr",
		name: file.name,
		ocrResult: { backend: "llm", text: "" },
	};
	const page = {
		blocks: [{ bbox: { height: 11, width: 13, x: 3, y: 7 }, text: "5 mg" }],
		height: 64,
		pageNumber: 1,
		width: 64,
	};
	const extract = (input: OcrContextDocument) =>
		extractContextFiles({ contextFiles: [input], modelSelection: selection, userId: "test-user" });
	for (const ocrResult of [
		undefined,
		{ backend: "unknown", text: "5 mg" },
		{ backend: "llm", text: 5 },
		{ backend: "llm", pages: [{ ...page, pageNumber: 0 }], text: "5 mg" },
		{ backend: "llm", pages: [{ ...page, height: Infinity }], text: "5 mg" },
		{
			backend: "llm",
			pages: [{ ...page, blocks: [{ bbox: { height: 11, width: 0, x: 3, y: 7 }, text: "5 mg" }] }],
			text: "5 mg",
		},
	]) {
		await expect(extract({ ...document, ocrResult } as OcrContextDocument)).rejects.toThrow(
			"Das OCR-Ergebnis ist ungültig.",
		);
	}
	await expect(
		extract({ ...document, data: file.data } as unknown as OcrContextDocument),
	).rejects.toThrow("Das OCR-Ergebnis ist ungültig.");
	for (const result of [
		{ backend: "llm" as const, text: "" },
		{ backend: "mistral-ocr" as const, text: "5 mg" },
		{ backend: "privatemode-ocr" as const, pages: [], text: "" },
	]) {
		const extracted = await extract({ ...document, ocrResult: result });
		expect(extracted.ocrResults).toEqual([result]);
	}
});
