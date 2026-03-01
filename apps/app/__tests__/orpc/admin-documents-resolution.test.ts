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
	createMockSession,
	createTestAiDefaults,
	createTestContext,
	createTestUser,
	startTestServer,
	type TestServer,
} from "../setup";

describe("Shared Resolver Usage (admin/documents)", () => {
	let server: TestServer;
	let context: ReturnType<typeof createTestContext>;
	let seeded: Awaited<ReturnType<typeof createTestAiDefaults>>;

	beforeEach(async () => {
		server = await startTestServer("admin-documents-resolution");
		const { user } = await createTestUser(server.db, { email: ADMIN_EMAIL });
		const session = createMockSession(user);
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
				requestId: "req-1",
				model: seeded.modelId,
				providerId: seeded.providerId,
				parameters: {
					temperature: 0.7,
					maxTokens: 512,
					thinking: true,
					thinkingExplicit: true,
					thinkingBudget: 8000,
				},
				documentType: "anamnese",
				compiledMessagesOverride: [
					{
						role: "user",
						content: "test",
					},
				],
			},
			{ context },
		);

		expect(result).toBeDefined();
		expect(typeof result[Symbol.asyncIterator]).toBe("function");

		// Drain stream so onFinish usage logging has a chance to complete.
		for await (const _ of result) {
			void _;
		}
		await new Promise((resolve) => setTimeout(resolve, 80));
	});

	test("documents.ocrToMarkdown resolves model via legacy connectionId alias", async () => {
		const imageBase64 = Buffer.from("fake-image").toString("base64");

		const result = await call(
			documentsHandler.ocrToMarkdown,
			{
				imagesBase64: [imageBase64],
				model: seeded.modelId,
				connectionId: seeded.providerId,
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
			id: providerId,
			name: "OCR Provider",
			protocol: "openrouter",
			baseUrl: null,
			apiKey: null,
		});
		await server.db.insert(aiModel).values([
			{
				id: textModelRecordId,
				providerId,
				modelId: "openrouter/text-model",
				displayName: "Text Model",
				supportsReasoning: false,
				inputModes: ["text"],
			},
			{
				id: fileModelRecordId,
				providerId,
				modelId: "openrouter/file-model",
				displayName: "File Model",
				supportsReasoning: false,
				inputModes: ["text", "file", "image"],
			},
		]);
		await server.db
			.insert(aiDefaults)
			.values({
				id: "global",
				defaultTextModelId: textModelRecordId,
				defaultFileImageModelId: fileModelRecordId,
				defaultSpeechToTextModelId: textModelRecordId,
				updatedAt: new Date(),
			})
			.onConflictDoUpdate({
				target: aiDefaults.id,
				set: {
					defaultTextModelId: textModelRecordId,
					defaultFileImageModelId: fileModelRecordId,
					defaultSpeechToTextModelId: textModelRecordId,
					updatedAt: new Date(),
				},
			});

		const result = await call(
			documentsHandler.parseForm,
			{
				fileBase64: Buffer.from("fake-pdf").toString("base64"),
				fieldMapping: [],
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
