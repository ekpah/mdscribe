import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { ORPCError, call } from "@orpc/server";
import {
	aiDefaults,
	aiModel,
	aiProvider,
	eq,
	usageEvent,
	userAiProvider,
} from "@repo/database";

import {
	createTestContext,
	createTestUser,
	startTestServer,
} from "@/__tests__/setup";
import type { TestServer } from "@/__tests__/setup";
import { decrypt, encrypt } from "@/lib/encryption";
import { getMonthlyScribeUsage } from "@/orpc/scribe/_lib/get-usage";
import {
	resolveModelByRecordId,
} from "@/orpc/scribe/providers";
import { aiProvidersHandler } from "@/orpc/user/ai-providers";

describe("User AI provider credentials", () => {
	let server: TestServer;
	let originalFetch: typeof globalThis.fetch;

	beforeEach(async () => {
		server = await startTestServer("user-ai-providers");
		originalFetch = globalThis.fetch;
	});

	afterEach(async () => {
		globalThis.fetch = originalFetch;
		await server?.close();
	});

	test("stores a write-only key only for an admin-exposed connection", async () => {
		const { session } = await createTestUser(server.db);
		const context = createTestContext({ db: server.db, session });
		const [provider] = await server.db
			.insert(aiProvider)
			.values({
				byokEnabled: true,
				id: crypto.randomUUID(),
				name: "OpenRouter",
				protocol: "openrouter",
			})
			.returning();
		expect(provider).toBeDefined();

		globalThis.fetch = (() =>
			Response.json({ data: { label: "private" } })) as unknown as typeof fetch;

		const saved = await call(
			aiProvidersHandler.save,
			{
				apiKey: "user-secret-key",
				name: "Mein OpenRouter",
				providerId: provider?.id ?? "",
			},
			{ context },
		);
		expect(saved?.enabled).toBe(true);
		expect(saved).not.toHaveProperty("apiKey");

		const [stored] = await server.db
			.select()
			.from(userAiProvider)
			.where(eq(userAiProvider.userId, session.user.id));
		expect(stored?.apiKey).not.toBe("user-secret-key");
		expect(await decrypt(stored?.apiKey ?? "")).toBe("user-secret-key");

		const status = await call(aiProvidersHandler.status, undefined, {
			context,
		});
		expect(status.connections[0]).toMatchObject({
			available: true,
			connectionId: provider?.id,
			credential: {
				enabled: true,
				hasApiKey: true,
				isVerified: true,
				name: "Mein OpenRouter",
			},
		});
		const verifiedAt = status.connections[0]?.credential?.verifiedAt;
		expect(verifiedAt).toBeInstanceOf(Date);

		await call(
			aiProvidersHandler.setEnabled,
			{ enabled: false, providerId: provider?.id ?? "" },
			{ context },
		);
		const inactiveStatus = await call(aiProvidersHandler.status, undefined, {
			context,
		});
		expect(inactiveStatus.connections[0]?.credential).toMatchObject({
			enabled: false,
			hasApiKey: true,
			isVerified: true,
		});
		expect(inactiveStatus.connections[0]?.credential?.verifiedAt).toEqual(
			verifiedAt,
		);
		expect(JSON.stringify(status)).not.toContain("user-secret-key");
	});

	test("shows only admin-selected models that can use the connection", async () => {
		const { session } = await createTestUser(server.db);
		const context = createTestContext({ db: server.db, session });
		const providerId = crypto.randomUUID();
		await server.db.insert(aiProvider).values({
			byokEnabled: true,
			id: providerId,
			name: "Configured Provider",
			protocol: "openrouter",
		});

		const modelIds = {
			agent: crypto.randomUUID(),
			evaluation: crypto.randomUUID(),
			fileImage: crypto.randomUUID(),
			speechToText: crypto.randomUUID(),
			text: crypto.randomUUID(),
		};
		await server.db.insert(aiModel).values([
			{
				displayName: "Standard Model",
				id: modelIds.text,
				modelId: "provider/standard",
				providerId,
			},
			{
				displayName: "Agent Model",
				id: modelIds.agent,
				modelId: "provider/agent",
				providerId,
			},
			{
				displayName: "Audio Model",
				id: modelIds.speechToText,
				modelId: "provider/audio",
				providerId,
			},
			{
				displayName: "File Model",
				id: modelIds.fileImage,
				modelId: "provider/file",
				providerId,
			},
			{
				displayName: "Evaluation Model",
				id: modelIds.evaluation,
				modelId: "provider/evaluation",
				providerId,
			},
		]);
		await server.db
			.insert(aiDefaults)
			.values({
				defaultAgentModelId: modelIds.agent,
				defaultAgentSupportsAudio: true,
				defaultAgentSupportsDocuments: true,
				defaultEvaluationModel: modelIds.evaluation,
				defaultFileImageModelId: modelIds.fileImage,
				defaultSpeechToTextModelId: modelIds.speechToText,
				defaultStandardSupportsAgent: true,
				defaultStandardSupportsAudio: true,
				defaultStandardSupportsDocuments: true,
				defaultTextModelId: modelIds.text,
				id: "global",
				updatedAt: new Date(),
			})
			.onConflictDoUpdate({
				set: {
					defaultAgentModelId: modelIds.agent,
					defaultAgentSupportsAudio: true,
					defaultAgentSupportsDocuments: true,
					defaultEvaluationModel: modelIds.evaluation,
					defaultFileImageModelId: modelIds.fileImage,
					defaultSpeechToTextModelId: modelIds.speechToText,
					defaultStandardSupportsAgent: true,
					defaultStandardSupportsAudio: true,
					defaultStandardSupportsDocuments: true,
					defaultTextModelId: modelIds.text,
					updatedAt: new Date(),
				},
				target: aiDefaults.id,
			});

		const status = await call(aiProvidersHandler.status, undefined, {
			context,
		});
		expect(status.connections[0]?.models).toEqual([
			{
				displayName: "Standard Model",
				modelId: "provider/standard",
				roles: ["text", "agent", "audio", "documents"],
			},
		]);
	});

	test("scopes mutations to the signed-in user and retains deletion when unavailable", async () => {
		const [{ session: sessionA }, { session: sessionB }] = await Promise.all([
			createTestUser(server.db),
			createTestUser(server.db),
		]);
		const contextA = createTestContext({ db: server.db, session: sessionA });
		const contextB = createTestContext({ db: server.db, session: sessionB });
		const [provider] = await server.db
			.insert(aiProvider)
			.values({
				byokEnabled: true,
				id: crypto.randomUUID(),
				name: "OpenRouter",
				protocol: "openrouter",
			})
			.returning();
		expect(provider).toBeDefined();

		await server.db.insert(userAiProvider).values({
			apiKey: await encrypt("user-a-secret"),
			enabled: true,
			id: crypto.randomUUID(),
			name: "A",
			providerId: provider?.id ?? "",
			userId: sessionA.user.id,
			validatedAt: new Date(),
		});

		await expect(
			call(
				aiProvidersHandler.delete,
				{ providerId: provider?.id ?? "" },
				{ context: contextB },
			),
		).rejects.toThrow(ORPCError);

		await server.db
			.update(aiProvider)
			.set({ byokEnabled: false })
			.where(eq(aiProvider.id, provider?.id ?? ""));
		const status = await call(aiProvidersHandler.status, undefined, {
			context: contextA,
		});
		expect(status.connections[0]?.available).toBe(false);

		await expect(
			call(
				aiProvidersHandler.setEnabled,
				{ enabled: true, providerId: provider?.id ?? "" },
				{ context: contextA },
			),
		).rejects.toThrow(ORPCError);
		await call(
			aiProvidersHandler.delete,
			{ providerId: provider?.id ?? "" },
			{ context: contextA },
		);
		expect(
			await server.db
				.select()
				.from(userAiProvider)
				.where(eq(userAiProvider.userId, sessionA.user.id)),
		).toHaveLength(0);
	});

	test("preserves the previous encrypted key when replacement validation fails", async () => {
		const { session } = await createTestUser(server.db);
		const context = createTestContext({ db: server.db, session });
		const [provider] = await server.db
			.insert(aiProvider)
			.values({
				byokEnabled: true,
				id: crypto.randomUUID(),
				name: "OpenRouter",
				protocol: "openrouter",
			})
			.returning();
		expect(provider).toBeDefined();
		await server.db.insert(userAiProvider).values({
			apiKey: await encrypt("working-key"),
			enabled: true,
			id: crypto.randomUUID(),
			name: "Working",
			providerId: provider?.id ?? "",
			userId: session.user.id,
			validatedAt: new Date(),
		});

		globalThis.fetch = (() =>
			new Response(null, { status: 401 })) as unknown as typeof fetch;
		await expect(
			call(
				aiProvidersHandler.save,
				{
					apiKey: "rejected-key",
					name: "Replacement",
					providerId: provider?.id ?? "",
				},
				{ context },
			),
		).rejects.toThrow(ORPCError);

		const [stored] = await server.db
			.select()
			.from(userAiProvider)
			.where(eq(userAiProvider.userId, session.user.id));
		expect(await decrypt(stored?.apiKey ?? "")).toBe("working-key");
		expect(stored?.name).toBe("Working");
	});

	test("runtime uses an active user credential only while the connection is exposed", async () => {
		const { session } = await createTestUser(server.db);
		const [provider] = await server.db
			.insert(aiProvider)
			.values({
				apiKey: await encrypt("operator-key"),
				byokEnabled: true,
				id: crypto.randomUUID(),
				name: "OpenAI",
				protocol: "openai",
			})
			.returning();
		const [model] = await server.db
			.insert(aiModel)
			.values({
				displayName: "GPT test",
				id: crypto.randomUUID(),
				modelId: "gpt-test",
				providerId: provider?.id ?? "",
			})
			.returning();
		expect(model).toBeDefined();
		await server.db.insert(userAiProvider).values({
			apiKey: await encrypt("user-key"),
			enabled: true,
			id: crypto.randomUUID(),
			name: "Personal",
			providerId: provider?.id ?? "",
			userId: session.user.id,
			validatedAt: new Date(),
		});

		const ownKeyModel = await resolveModelByRecordId(
			model?.id ?? "",
			server.db,
			session.user.id,
		);
		expect(ownKeyModel.credentialSource).toBe("user_byok");

		await server.db
			.update(aiProvider)
			.set({ byokEnabled: false })
			.where(eq(aiProvider.id, provider?.id ?? ""));
		const operatorModel = await resolveModelByRecordId(
			model?.id ?? "",
			server.db,
			session.user.id,
		);
		expect(operatorModel.credentialSource).toBe("operator");
	});

	test("user-funded usage does not consume the operator-funded quota", async () => {
		const { session } = await createTestUser(server.db);
		await server.db.insert(usageEvent).values([
			{
				cost: "1.000000",
				metadata: {
					credentialSource: "operator",
					promptName: "operator",
				},
				name: "ai_scribe_generation",
				userId: session.user.id,
			},
			{
				cost: "99.000000",
				metadata: {
					credentialSource: "user_byok",
					promptName: "byok",
				},
				name: "ai_scribe_generation",
				userId: session.user.id,
			},
		]);

		const usage = await getMonthlyScribeUsage({
			db: server.db,
			session,
		});
		expect(usage.count).toBe(2);
		expect(usage.totalCost).toBe(1);
	});
});
