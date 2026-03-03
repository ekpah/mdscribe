import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { aiDefaults, aiModel, aiProvider, eq, sql } from '@repo/database';
import type { Database } from '@repo/database';
import { startTestServer } from '../setup';
import type { TestServer } from '../setup';

describe("legacy AI schema migration semantics", () => {
	let server: TestServer;
	let db: Database;

	beforeEach(async () => {
		server = await startTestServer("ai-schema-migration-semantics");
		({ db } = server);
	});

	afterEach(async () => {
		await server.close();
	});

	test("migrates legacy thinking/default flags into supportsReasoning + AiDefaults", async () => {
		const providerId = crypto.randomUUID();
		const modelRecordId = crypto.randomUUID();

		await db.insert(aiProvider).values({
			apiKey: null,
			baseUrl: null,
			id: providerId,
			name: "Legacy Provider",
			protocol: "openrouter",
		});

		await db.insert(aiModel).values({
			displayName: "Legacy Model",
			id: modelRecordId,
			inputModes: ["text"],
			modelId: "openrouter/legacy-model",
			providerId,
			supportsReasoning: false,
		});

		await db.execute(
			sql.raw(
				`ALTER TABLE "AiModel" ADD COLUMN IF NOT EXISTS "supportsThinking" boolean DEFAULT false`,
			),
		);
		await db.execute(
			sql.raw(
				`ALTER TABLE "AiModel" ADD COLUMN IF NOT EXISTS "isDefaultText" boolean DEFAULT false`,
			),
		);
		await db.execute(
			sql.raw(
				`ALTER TABLE "AiModel" ADD COLUMN IF NOT EXISTS "isDefaultMultimodal" boolean DEFAULT false`,
			),
		);
		await db.execute(
			sql.raw(
				`ALTER TABLE "AiModel" ADD COLUMN IF NOT EXISTS "isDefaultSpeechToText" boolean DEFAULT false`,
			),
		);

		await db.execute(sql`
			UPDATE "AiModel"
			SET "supportsThinking" = true,
					"isDefaultText" = true,
					"isDefaultMultimodal" = true,
					"isDefaultSpeechToText" = true
			WHERE "id" = ${modelRecordId}
		`);

		await db.execute(
			sql.raw(`UPDATE "AiModel" SET "supportsReasoning" = "supportsThinking"`),
		);
		await db.execute(
			sql.raw(`
				INSERT INTO "AiDefaults" ("id", "defaultTextModelId", "defaultFileImageModelId", "defaultSpeechToTextModelId")
				VALUES (
					'global',
					(SELECT "id" FROM "AiModel" WHERE "isDefaultText" = true LIMIT 1),
					(SELECT "id" FROM "AiModel" WHERE "isDefaultMultimodal" = true LIMIT 1),
					(SELECT "id" FROM "AiModel" WHERE "isDefaultSpeechToText" = true LIMIT 1)
				)
				ON CONFLICT ("id") DO UPDATE
				SET "defaultTextModelId" = COALESCE(EXCLUDED."defaultTextModelId", "AiDefaults"."defaultTextModelId"),
						"defaultFileImageModelId" = COALESCE(EXCLUDED."defaultFileImageModelId", "AiDefaults"."defaultFileImageModelId"),
						"defaultSpeechToTextModelId" = COALESCE(EXCLUDED."defaultSpeechToTextModelId", "AiDefaults"."defaultSpeechToTextModelId")
			`),
		);

		const migratedModel = await db.query.aiModel.findFirst({
			where: eq(aiModel.id, modelRecordId),
		});
		expect(migratedModel?.supportsReasoning).toBe(true);

		const defaults = await db.query.aiDefaults.findFirst({
			where: eq(aiDefaults.id, "global"),
		});
		expect(defaults?.defaultTextModelId).toBe(modelRecordId);
		expect(defaults?.defaultFileImageModelId).toBe(modelRecordId);
		expect(defaults?.defaultSpeechToTextModelId).toBe(modelRecordId);
	});
});
