import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { call } from "@orpc/server";
import {
	aiDefaults,
	aiModel,
	aiProvider,
	eq,
	usageEvent,
} from "@repo/database";
import { voiceFillHandler } from "@/orpc/scribe/voice-fill";
import { createMockSession, createTestAiDefaults, createTestContext, createTestUser, startTestServer } from '../setup';
import type { TestServer } from '../setup';

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
				audioFiles: [
					{
						data: Buffer.from("test").toString("base64"),
						mimeType: "audio/wav",
					},
				],
				inputFields: [
					{
						description: "",
						label: "Field 1",
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
			apiKey: null,
			baseUrl: null,
			id: providerId,
			name: "Speech Provider",
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
				displayName: "Speech Model",
				id: speechModelRecordId,
				inputModes: ["text", "audio"],
				modelId: "openrouter/speech-model",
				providerId,
				supportsReasoning: false,
			},
		]);
		await server.db
			.insert(aiDefaults)
			.values({
				defaultFileImageModelId: textModelRecordId,
				defaultSpeechToTextModelId: speechModelRecordId,
				defaultTextModelId: textModelRecordId,
				id: "global",
				updatedAt: new Date(),
			})
			.onConflictDoUpdate({
				set: {
					defaultFileImageModelId: textModelRecordId,
					defaultSpeechToTextModelId: speechModelRecordId,
					defaultTextModelId: textModelRecordId,
					updatedAt: new Date(),
				},
				target: aiDefaults.id,
			});

		const { user } = await createTestUser(server.db);
		const session = createMockSession(user);
		const context = createTestContext({ db: server.db, session });

		await call(
			voiceFillHandler,
			{
				audioFiles: [
					{
						data: Buffer.from("test").toString("base64"),
						mimeType: "audio/wav",
					},
				],
				inputFields: [
					{
						description: "",
						label: "Field 1",
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
