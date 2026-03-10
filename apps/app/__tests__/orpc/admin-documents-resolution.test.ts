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
} from "../setup";
import type { TestServer } from "../setup";

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
		await server.close();
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
					temperature: 0.7,
					thinking: true,
					thinkingBudget: 8000,
					thinkingExplicit: true,
				},
				providerId: seeded.providerId,
				requestId: "req-1",
			},
			{ context },
		);

		expect(result).toBeDefined();
		expect(typeof result[Symbol.asyncIterator]).toBe("function");

		// Drain stream so onFinish usage logging has a chance to complete.
		for await (const _ of result) {
			undefined;
		}
		await new Promise((resolve) => setTimeout(resolve, 80));
	});

	test("documents.ocrToMarkdown resolves model via legacy connectionId alias", async () => {
		const imageBase64 = Buffer.from("fake-image").toString("base64");

		const result = await call(
			documentsHandler.ocrToMarkdown,
			{
				connectionId: seeded.providerId,
				imagesBase64: [imageBase64],
				model: seeded.modelId,
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
				inputModes: ["text"],
				modelId: "openrouter/text-model",
				providerId,
				supportsReasoning: false,
			},
			{
				displayName: "File Model",
				id: fileModelRecordId,
				inputModes: ["text", "file", "image"],
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
});
