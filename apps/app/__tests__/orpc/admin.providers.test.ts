import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { call, ORPCError } from "@orpc/server";
import { aiDefaults, aiModel, aiProvider, eq } from "@repo/database";
import { providersHandler } from "@/orpc/admin/providers";
import {
	ADMIN_EMAIL,
	createMockSession,
	createTestContext,
	createTestUser,
	startTestServer,
	type TestServer,
} from "../setup";

describe("Admin Providers Handler", () => {
	let server: TestServer;
	let context: ReturnType<typeof createTestContext>;
	let originalFetch: typeof globalThis.fetch;

	beforeEach(async () => {
		server = await startTestServer("admin-providers");
		const { user } = await createTestUser(server.db, { email: ADMIN_EMAIL });
		const session = createMockSession(user);
		context = createTestContext({ db: server.db, session });
		originalFetch = globalThis.fetch;
	});

	afterEach(async () => {
		globalThis.fetch = originalFetch;
		await server.close();
	});

	test("connections.create validates provider before persistence", async () => {
		globalThis.fetch = (async () =>
			new Response("unauthorized", { status: 401 })) as unknown as typeof fetch;

		await expect(
			call(
				providersHandler.connections.create,
				{
					name: "Broken OpenRouter",
					protocol: "openrouter",
					apiKey: "invalid-key",
				},
				{ context },
			),
		).rejects.toThrow(ORPCError);

		const providers = await server.db.select().from(aiProvider);
		const models = await server.db.select().from(aiModel);
		expect(providers).toHaveLength(0);
		expect(models).toHaveLength(0);
	});

	test("connections.create syncs fetched provider models", async () => {
		globalThis.fetch = (async () =>
			new Response(
				JSON.stringify({
					data: [
						{
							id: "anthropic/claude-3.7-sonnet",
							name: "Claude 3.7 Sonnet",
							supported_parameters: ["reasoning"],
							architecture: { modality: "text+image->text" },
						},
						{
							id: "openai/gpt-4.1-mini",
							name: "GPT-4.1 mini",
							supported_parameters: [],
							architecture: { modality: "text->text" },
						},
					],
				}),
				{ status: 200 },
			)) as unknown as typeof fetch;

		const created = await call(
			providersHandler.connections.create,
			{
				name: "OpenRouter",
				protocol: "openrouter",
				apiKey: "or-key",
			},
			{ context },
		);

		expect(created.modelCount).toBe(2);
		expect(created.syncResult).toEqual({ inserted: 2, updated: 0, removed: 0 });
		expect(created.hasApiKey).toBe(true);

		const providers = await server.db.select().from(aiProvider);
		expect(providers).toHaveLength(1);
		expect(providers[0]?.apiKey).toBeTruthy();
		expect(providers[0]?.apiKey).not.toBe("or-key");
		const providerId = providers[0]?.id;
		expect(providerId).toBeDefined();

		const models = await server.db.query.aiModel.findMany({
			where: eq(aiModel.providerId, providerId ?? ""),
		});
		expect(models).toHaveLength(2);

		const claude = models.find(
			(model) => model.modelId === "anthropic/claude-3.7-sonnet",
		);
		expect(claude?.supportsReasoning).toBe(true);
		expect(claude?.inputModes).toEqual(["text", "image", "file"]);

		const gpt = models.find((model) => model.modelId === "openai/gpt-4.1-mini");
		expect(gpt?.supportsReasoning).toBe(false);
		expect(gpt?.inputModes).toEqual(["text"]);
	});

	test("connections.refreshModels upserts and removes stale models", async () => {
		let callCount = 0;
		globalThis.fetch = (async () => {
			callCount += 1;
			if (callCount === 1) {
				return new Response(
					JSON.stringify({
						data: [
							{
								id: "openai/gpt-4o-mini",
								name: "GPT-4o mini",
								supported_parameters: [],
								architecture: { modality: "text->text" },
							},
							{
								id: "openai/gpt-4.1-mini",
								name: "GPT-4.1 mini",
								supported_parameters: [],
								architecture: { modality: "text->text" },
							},
						],
					}),
					{ status: 200 },
				);
			}

			return new Response(
				JSON.stringify({
					data: [
						{
							id: "openai/gpt-4o-mini",
							name: "GPT-4o mini (updated)",
							supported_parameters: ["reasoning"],
							architecture: { modality: "text+image->text" },
						},
						{
							id: "anthropic/claude-3.7-sonnet",
							name: "Claude 3.7 Sonnet",
							supported_parameters: ["reasoning"],
							architecture: { modality: "text+image->text" },
						},
					],
				}),
				{ status: 200 },
			);
		}) as unknown as typeof fetch;

		const created = await call(
			providersHandler.connections.create,
			{
				name: "OpenRouter",
				protocol: "openrouter",
				apiKey: "or-key",
			},
			{ context },
		);

		const refreshed = await call(
			providersHandler.connections.refreshModels,
			{ id: created.id },
			{ context },
		);

		expect(refreshed.syncResult).toEqual({
			inserted: 1,
			updated: 1,
			removed: 1,
		});

		const models = await server.db.query.aiModel.findMany({
			where: eq(aiModel.providerId, created.id),
		});
		expect(models).toHaveLength(2);
		expect(
			models.some((model) => model.modelId === "openai/gpt-4.1-mini"),
		).toBe(false);

		const updated = models.find(
			(model) => model.modelId === "openai/gpt-4o-mini",
		);
		expect(updated?.displayName).toBe("GPT-4o mini (updated)");
		expect(updated?.supportsReasoning).toBe(true);
		expect(updated?.inputModes).toEqual(["text", "image", "file"]);

		const inserted = models.find(
			(model) => model.modelId === "anthropic/claude-3.7-sonnet",
		);
		expect(inserted).toBeDefined();
	});

	test("connections.create rejects openai-compatible providers without base URL", async () => {
		let fetchCalled = false;
		globalThis.fetch = (async () => {
			fetchCalled = true;
			return new Response("unexpected", { status: 500 });
		}) as unknown as typeof fetch;

		await expect(
			call(
				providersHandler.connections.create,
				{
					name: "Local LLM",
					protocol: "openai-compatible",
				},
				{ context },
			),
		).rejects.toThrow("Base URL");

		expect(fetchCalled).toBe(false);
		expect(await server.db.select().from(aiProvider)).toHaveLength(0);
		expect(await server.db.select().from(aiModel)).toHaveLength(0);
	});

	test("connections.delete cascades provider models and nulls defaults", async () => {
		globalThis.fetch = (async () =>
			new Response(
				JSON.stringify({
					data: [
						{
							id: "openai/gpt-4.1-mini",
							name: "GPT-4.1 mini",
							supported_parameters: [],
							architecture: { modality: "text->text" },
						},
					],
				}),
				{ status: 200 },
			)) as unknown as typeof fetch;

		const created = await call(
			providersHandler.connections.create,
			{
				name: "OpenRouter",
				protocol: "openrouter",
				apiKey: "or-key",
			},
			{ context },
		);

		const [model] = await server.db.query.aiModel.findMany({
			where: eq(aiModel.providerId, created.id),
		});
		expect(model).toBeDefined();
		if (!model) {
			throw new Error("Expected provider model to exist");
		}

		await call(
			providersHandler.defaults.set,
			{
				defaultType: "text",
				modelId: model.id,
			},
			{ context },
		);

		await call(
			providersHandler.connections.delete,
			{
				id: created.id,
			},
			{ context },
		);

		expect(
			await server.db.query.aiProvider.findFirst({
				where: eq(aiProvider.id, created.id),
			}),
		).toBeUndefined();
		expect(
			await server.db.query.aiModel.findMany({
				where: eq(aiModel.providerId, created.id),
			}),
		).toHaveLength(0);

		const defaults = await server.db.query.aiDefaults.findFirst({
			where: eq(aiDefaults.id, "global"),
		});
		expect(defaults?.defaultTextModelId).toBeNull();
	});
});
