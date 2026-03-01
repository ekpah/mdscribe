import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { call } from "@orpc/server";
import {
	aiDefaults,
	aiModel,
	aiProvider,
	eq,
	usageEvent,
} from "@repo/database";
import { voiceFillHandler } from "@/orpc/scribe/voiceFill";
import {
	createMockSession,
	createTestAiDefaults,
	createTestContext,
	createTestUser,
	startTestServer,
	type TestServer,
} from "../setup";

describe("Scribe voiceFill Handler", () => {
	let server: TestServer;

	beforeEach(async () => {
		server = await startTestServer("voicefill-test");
		await createTestAiDefaults(server.db);
	});

	afterEach(async () => {
		await server.close();
	});

	test("returns fieldValues for valid input", async () => {
		const { user } = await createTestUser(server.db);
		const session = createMockSession(user);
		const context = createTestContext({ db: server.db, session });

		const result = await call(
			voiceFillHandler,
			{
				inputFields: [
					{
						label: "Field 1",
						description: "",
					},
				],
				audioFiles: [
					{
						data: Buffer.from("test").toString("base64"),
						mimeType: "audio/wav",
					},
				],
			},
			{ context },
		);

		expect(result).toBeDefined();
		expect(result.fieldValues).toBeDefined();
		expect(result.fieldValues.test).toBe("value");
	});

	test("resolves speech default model for audio input", async () => {
		const providerId = crypto.randomUUID();
		const textModelRecordId = crypto.randomUUID();
		const speechModelRecordId = crypto.randomUUID();

		await server.db.insert(aiProvider).values({
			id: providerId,
			name: "Speech Provider",
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
				id: speechModelRecordId,
				providerId,
				modelId: "openrouter/speech-model",
				displayName: "Speech Model",
				supportsReasoning: false,
				inputModes: ["text", "audio"],
			},
		]);
		await server.db
			.insert(aiDefaults)
			.values({
				id: "global",
				defaultTextModelId: textModelRecordId,
				defaultFileImageModelId: textModelRecordId,
				defaultSpeechToTextModelId: speechModelRecordId,
				updatedAt: new Date(),
			})
			.onConflictDoUpdate({
				target: aiDefaults.id,
				set: {
					defaultTextModelId: textModelRecordId,
					defaultFileImageModelId: textModelRecordId,
					defaultSpeechToTextModelId: speechModelRecordId,
					updatedAt: new Date(),
				},
			});

		const { user } = await createTestUser(server.db);
		const session = createMockSession(user);
		const context = createTestContext({ db: server.db, session });

		await call(
			voiceFillHandler,
			{
				inputFields: [
					{
						label: "Field 1",
						description: "",
					},
				],
				audioFiles: [
					{
						data: Buffer.from("test").toString("base64"),
						mimeType: "audio/wav",
					},
				],
			},
			{ context },
		);

		const [logged] = await server.db
			.select()
			.from(usageEvent)
			.where(eq(usageEvent.name, "ai_input_voice_fill"));
		expect(logged?.model).toBe("openrouter/speech-model");
	});
});
