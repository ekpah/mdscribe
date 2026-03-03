import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { call } from "@orpc/server";
import { aiModel, eq } from "@repo/database";
import { modelsHandler } from "@/orpc/admin/models";
import { ADMIN_EMAIL, createMockSession, createTestAiDefaults, createTestContext, createTestUser, startTestServer } from '../setup';
import type { TestServer } from '../setup';

describe("Admin Models Handler", () => {
	let server: TestServer;
	let context: ReturnType<typeof createTestContext>;
	let seeded: Awaited<ReturnType<typeof createTestAiDefaults>>;

	beforeEach(async () => {
		server = await startTestServer("admin-models");
		const { user } = await createTestUser(server.db, { email: ADMIN_EMAIL });
		const session = createMockSession(user);
		context = createTestContext({ db: server.db, session });
		seeded = await createTestAiDefaults(server.db);
	});

	afterEach(async () => {
		await server.close();
	});

	test("list returns DB-backed models with provider metadata", async () => {
		const models = await call(modelsHandler.list, undefined, { context });
		const seededModel = models.find(
			(model) => model.id === seeded.modelRecordId,
		);

		expect(models.length).toBeGreaterThan(0);
		expect(seededModel).toBeDefined();
		expect(seededModel?.providerId).toBe(seeded.providerId);
		expect(seededModel?.modelId).toBe(seeded.modelId);
		expect(seededModel?.connectionId).toBe(seeded.providerId);
		expect(seededModel?.inputModes).toEqual(["text", "audio", "file", "image"]);
		expect(seededModel?.supportsReasoning).toBe(true);
	});

	test("list reflects DB model updates without provider API calls", async () => {
		await server.db
			.update(aiModel)
			.set({
				displayName: "Renamed test model",
				inputModes: ["text", "image", "file"],
				supportsReasoning: false,
			})
			.where(eq(aiModel.id, seeded.modelRecordId));

		const models = await call(modelsHandler.list, undefined, { context });
		const updatedModel = models.find(
			(model) => model.id === seeded.modelRecordId,
		);

		expect(updatedModel?.name).toBe("Renamed test model");
		expect(updatedModel?.supportsReasoning).toBe(false);
		expect(updatedModel?.inputModes).toEqual(["text", "image", "file"]);
	});
});
