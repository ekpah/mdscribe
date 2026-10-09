import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { call } from "@orpc/server";
import { aiDefaults, aiModel, aiProvider, eq } from "@repo/database";

import { ADMIN_EMAIL, createTestContext, createTestUser, startTestServer } from "@/__tests__/setup";
import type { TestServer } from "@/__tests__/setup";
import { providersHandler } from "@/orpc/admin/providers";
import { resolveGenerationStrategy } from "@/orpc/scribe/providers";

const validOcrResponse = {
	results: [{ bbox: [1, 2, 40, 20], confidence: 0.99, text: "Probe" }],
};

interface OcrRequest {
	authorization: string | null;
	file: File;
	language: FormDataEntryValue | null;
	method: string;
	url: string;
}

describe("OCR HTTP provider", () => {
	let app: TestServer;
	let context: ReturnType<typeof createTestContext>;
	let ocrServer: ReturnType<typeof Bun.serve>;
	let responseBody: unknown;
	let responseStatus: number;
	let requests: OcrRequest[];

	beforeEach(async () => {
		app = await startTestServer("ocr-http-provider");
		const { session } = await createTestUser(app.db, { email: ADMIN_EMAIL });
		context = createTestContext({ db: app.db, session });
		responseBody = validOcrResponse;
		responseStatus = 200;
		requests = [];
		ocrServer = Bun.serve({
			async fetch(request) {
				const form = await request.formData();
				requests.push({
					authorization: request.headers.get("authorization"),
					file: form.get("file") as File,
					language: form.get("language"),
					method: request.method,
					url: request.url,
				});
				return Response.json(responseBody, { status: responseStatus });
			},
			hostname: "127.0.0.1",
			port: 0,
		});
	});

	afterEach(async () => {
		ocrServer?.stop(true);
		await app?.close();
	});

	const endpoint = () => `${ocrServer.url}ocr/`;

	test("create, update, and refresh probe the exact endpoint and preserve an encrypted bearer key", async () => {
		const created = await call(
			providersHandler.connections.create,
			{
				apiKey: "first-secret",
				baseUrl: endpoint(),
				name: "Paddle",
				protocol: "ocr-http",
			},
			{ context },
		);

		expect(created).toMatchObject({ baseUrl: endpoint(), hasApiKey: true, modelCount: 1 });
		expect(JSON.stringify(created)).not.toContain("first-secret");
		const [stored] = await app.db.select().from(aiProvider);
		expect(stored?.apiKey).not.toBe("first-secret");
		expect(stored?.baseUrl).toBe(endpoint());
		const models = await app.db.query.aiModel.findMany({
			where: eq(aiModel.providerId, created.id),
		});
		expect(models.map(({ modelId }) => modelId)).toEqual(["ocr"]);

		await call(
			providersHandler.connections.update,
			{ apiKey: "second-secret", baseUrl: endpoint(), id: created.id },
			{ context },
		);
		const refreshed = await call(
			providersHandler.connections.refreshModels,
			{ id: created.id },
			{ context },
		);
		expect(refreshed.models).toEqual([
			{
				displayName: "OCR HTTP",
				modelId: "ocr",
				supportedParameters: [],
				supportsReasoning: false,
			},
		]);
		expect(requests).toHaveLength(3);
		for (const request of requests) {
			expect(request.url).toBe(endpoint());
			expect(request.method).toBe("POST");
		}
		expect(requests[0]?.authorization).toBe("Bearer first-secret");
		expect(requests[1]?.authorization).toBe("Bearer second-secret");
		expect(requests[2]?.authorization).toBe("Bearer second-secret");
		expect(requests[0]?.language).toBe("de");
		const file = requests[0]?.file;
		expect(file).toBeInstanceOf(File);
		const bytes = Buffer.from(await file?.arrayBuffer());
		expect(bytes.readUInt32BE(16)).toBe(64);
		expect(bytes.readUInt32BE(20)).toBe(64);
	});

	test("round-trips the OCR default into an HTTP selection without constructing a language model", async () => {
		const created = await call(
			providersHandler.connections.create,
			{ apiKey: "resolver-secret", baseUrl: endpoint(), name: "OCR Service", protocol: "ocr-http" },
			{ context },
		);
		const [ocrModel] = await app.db.query.aiModel.findMany({
			where: eq(aiModel.providerId, created.id),
		});
		expect(ocrModel).toBeDefined();

		const llmProviderId = crypto.randomUUID();
		const llmModelId = crypto.randomUUID();
		await app.db
			.insert(aiProvider)
			.values({ id: llmProviderId, name: "LLM", protocol: "openrouter" });
		await app.db.insert(aiModel).values({
			displayName: "Text",
			id: llmModelId,
			modelId: "vendor/text",
			providerId: llmProviderId,
		});
		await call(
			providersHandler.defaults.set,
			{ defaultType: "text", modelId: llmModelId },
			{ context },
		);
		await call(
			providersHandler.defaults.set,
			{ defaultType: "file-image", modelId: ocrModel?.id },
			{ context },
		);
		await call(
			providersHandler.defaults.setOptions,
			{ standardSupportsDocuments: false },
			{ context },
		);

		const strategy = await resolveGenerationStrategy(app.db, { hasFiles: true });
		expect(strategy.files).toEqual({
			mode: "preprocess",
			selection: {
				kind: "ocr-service",
				model: {
					apiKey: "resolver-secret",
					credentialSource: "operator",
					endpoint: endpoint(),
					modelName: "OCR Service/ocr",
					providerId: created.id,
					providerProtocol: "ocr-http",
				},
				slot: "file-image",
			},
			strategy: "multimodal",
		});
	});

	test("rejects OCR defaults outside file-image, BYOK, protocol switching, and extra models", async () => {
		const created = await call(
			providersHandler.connections.create,
			{ baseUrl: endpoint(), name: "OCR", protocol: "ocr-http" },
			{ context },
		);
		const [model] = await app.db.query.aiModel.findMany({
			where: eq(aiModel.providerId, created.id),
		});

		for (const defaultType of ["text", "agent", "speech-to-text"] as const) {
			await expect(
				call(providersHandler.defaults.set, { defaultType, modelId: model?.id }, { context }),
			).rejects.toThrow("nur als Dokumenten-Modell");
		}
		await expect(
			call(
				providersHandler.connections.setByokEnabled,
				{ enabled: true, id: created.id },
				{ context },
			),
		).rejects.toThrow("BYOK ist für OCR HTTP nicht verfügbar");
		await expect(
			call(
				providersHandler.connections.update,
				{ baseUrl: null, id: created.id, protocol: "openrouter" },
				{ context },
			),
		).rejects.toThrow("Wechsel zwischen OCR und LLM");
		await expect(
			call(
				providersHandler.models.create,
				{
					displayName: "Extra",
					modelId: "extra",
					providerId: created.id,
					supportedParameters: [],
					supportsReasoning: false,
				},
				{ context },
			),
		).rejects.toThrow("genau einen OCR-Endpunkt");

		const llmId = crypto.randomUUID();
		await app.db.insert(aiProvider).values({ id: llmId, name: "LLM", protocol: "openrouter" });
		await expect(
			call(
				providersHandler.connections.update,
				{ baseUrl: endpoint(), id: llmId, protocol: "ocr-http" },
				{ context },
			),
		).rejects.toThrow("Wechsel zwischen OCR und LLM");
	});

	test.each([
		[{ results: [{ bbox: [0, 0, 65, 10], confidence: 1, text: "outside" }] }, "exceed"],
		[
			{ results: [{ bbox: [10, 10, 5, 20], confidence: 1, text: "inverted" }] },
			"LiteParse OCR protocol",
		],
		[{ nope: [] }, "LiteParse OCR protocol"],
	] as const)("rejects malformed OCR responses", async (body, message) => {
		responseBody = body;
		await expect(
			call(
				providersHandler.connections.previewModels,
				{ baseUrl: endpoint(), protocol: "ocr-http" },
				{ context },
			),
		).rejects.toThrow(message);
	});

	test("rejects provider HTTP failures", async () => {
		responseBody = { error: "unavailable" };
		responseStatus = 503;
		await expect(
			call(
				providersHandler.connections.previewModels,
				{ baseUrl: endpoint(), protocol: "ocr-http" },
				{ context },
			),
		).rejects.toThrow("OCR check failed: HTTP 503");
		expect(await app.db.select().from(aiDefaults)).toHaveLength(0);
	});
});
