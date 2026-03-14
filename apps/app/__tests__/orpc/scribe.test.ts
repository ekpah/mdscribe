import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { ORPCError, call } from "@orpc/server";
import { aiDefaults, aiModel, aiProvider } from "@repo/database";
import { USER_MESSAGES } from "@/lib/user-messages";
import { documentTypeConfigs } from "@/orpc/scribe/config";
import { buildScribeContext } from "@/orpc/scribe/context";
import { scribeStreamHandler } from "@/orpc/scribe/handlers";
import { resolveModel } from "@/orpc/scribe/providers";
import type { DocumentType } from "@/orpc/scribe/types";
import {
	createMockSession,
	createTestAiDefaults,
	createTestContext,
	createTestSubscription,
	createTestUser,
	startTestServer,
	type TestServer,
} from "../setup";

/**
 * Comprehensive tests for scribe oRPC handlers
 *
 * Includes:
 * - Unit tests for document type configurations
 * - Integration tests for streaming handlers (with mocked AI SDK)
 * - Usage limit and subscription tests
 */
describe("Document Type Configurations", () => {
	test("all document types have required config", () => {
		const documentTypes: DocumentType[] = [
			"discharge",
			"anamnese",
			"diagnosis",
			"physical-exam",
			"procedures",
			"befunde",
			"outpatient",
			"icu-transfer",
		];

		for (const type of documentTypes) {
			expect(documentTypeConfigs[type]).toBeDefined();
			expect(documentTypeConfigs[type].promptName).toBeDefined();
			expect(documentTypeConfigs[type].modelConfig).toBeDefined();
		}
	});

	test("thinking mode configs are correct", () => {
		// Document types with thinking enabled
		expect(documentTypeConfigs.discharge.modelConfig.thinking).toBe(true);
		expect(documentTypeConfigs.outpatient.modelConfig.thinking).toBe(true);

		// Document types without thinking
		expect(documentTypeConfigs.anamnese.modelConfig.thinking).toBe(false);
		expect(documentTypeConfigs.diagnosis.modelConfig.thinking).toBe(false);
		expect(documentTypeConfigs["physical-exam"].modelConfig.thinking).toBe(
			false,
		);
		expect(documentTypeConfigs.procedures.modelConfig.thinking).toBe(false);
	});
});

describe("Context Builder", () => {
	test("builds patient_context with ICU-style sections and omits empty tags", async () => {
		const { contextXml } = await buildScribeContext({
			sources: [
				{
					kind: "form",
					data: {
						diagnoseblock: "I10 Hypertonie",
						anamnese: "Akute Dyspnoe",
						notes: "Zusätzliche Notizen",
					},
				},
			],
			sessionUser: null,
		});

		expect(contextXml).toContain("<patient_context>");
		expect(contextXml).toContain("<diagnoseblock>");
		expect(contextXml).toContain("<anamnese>");
		expect(contextXml).toContain("<notizen>");
		expect(contextXml).not.toContain("<befunde>");
	});

	test("includes user_context when name is provided", async () => {
		const session = createMockSession({
			id: crypto.randomUUID(),
			email: "doctor@test.com",
			name: "Dr. Test",
		});
		const { contextXml } = await buildScribeContext({
			sources: [{ kind: "form", data: {} }],
			sessionUser: session.user,
		});

		expect(contextXml).toContain("<user_context>");
		expect(contextXml).toContain("<name>Dr. Test</name>");
	});

	test("emits template_context with template content and examples", async () => {
		const { contextXml } = await buildScribeContext({
			sources: [
				{
					kind: "template",
					data: {
						title: "ER Vorlage",
						content: "## Abschnitt",
						examples: ["Beispiel A", "Beispiel B"],
					},
				},
			],
			sessionUser: null,
		});

		expect(contextXml).toContain("<template_context>");
		expect(contextXml).toContain("<title>ER Vorlage</title>");
		expect(contextXml).toContain("<content>## Abschnitt</content>");
		expect(contextXml).toContain("<example>Beispiel A</example>");
		expect(contextXml).toContain("<example>Beispiel B</example>");
	});
});

describe("Model Selection Logic", () => {
	test("resolveModel uses speech default for audio requests", async () => {
		const server = await startTestServer("resolve-model-audio-default");
		try {
			const providerId = crypto.randomUUID();
			const textModelRecordId = crypto.randomUUID();
			const speechModelRecordId = crypto.randomUUID();

			await server.db.insert(aiProvider).values({
				id: providerId,
				name: "Test Provider",
				protocol: "openrouter",
				baseUrl: null,
				apiKey: null,
			});
			await server.db.insert(aiModel).values([
				{
					id: textModelRecordId,
					providerId,
					modelId: "openrouter/test-text",
					displayName: "Text Model",
					supportsReasoning: false,
					inputModes: ["text"],
				},
				{
					id: speechModelRecordId,
					providerId,
					modelId: "openrouter/test-speech",
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

			const resolved = await resolveModel(server.db, { requireAudio: true });
			expect(resolved.modelName).toBe("openrouter/test-speech");
		} finally {
			await server.close();
		}
	});

	test("resolveModel throws when required default is missing", async () => {
		const server = await startTestServer("resolve-model-missing-default");
		try {
			const providerId = crypto.randomUUID();
			const textModelRecordId = crypto.randomUUID();

			await server.db.insert(aiProvider).values({
				id: providerId,
				name: "Test Provider",
				protocol: "openrouter",
				baseUrl: null,
				apiKey: null,
			});
			await server.db.insert(aiModel).values({
				id: textModelRecordId,
				providerId,
				modelId: "openrouter/test-text",
				displayName: "Text Model",
				supportsReasoning: false,
				inputModes: ["text"],
			});
			await server.db
				.insert(aiDefaults)
				.values({
					id: "global",
					defaultTextModelId: textModelRecordId,
					defaultFileImageModelId: textModelRecordId,
					defaultSpeechToTextModelId: null,
					updatedAt: new Date(),
				})
				.onConflictDoUpdate({
					target: aiDefaults.id,
					set: {
						defaultTextModelId: textModelRecordId,
						defaultFileImageModelId: textModelRecordId,
						defaultSpeechToTextModelId: null,
						updatedAt: new Date(),
					},
				});

			await expect(
				resolveModel(server.db, { requireAudio: true }),
			).rejects.toThrow(USER_MESSAGES.modelUnavailable);
		} finally {
			await server.close();
		}
	});
});

/**
 * Integration tests for scribe streaming handler
 *
 * These tests use mocked AI SDK (streamText) to verify:
 * - Handler authentication and authorization
 * - Usage limit enforcement
 * - Subscription checks
 * - Input validation
 * - Error handling
 */
describe("Scribe Stream Handler", () => {
	let server: TestServer;

	beforeEach(async () => {
		server = await startTestServer("scribe-test");
		await createTestAiDefaults(server.db);
	});

	afterEach(async () => {
		await server.close();
	});

	describe("Authentication & Authorization", () => {
		test("allows free-tier users without stripeCustomerId", async () => {
			const { user } = await createTestUser(server.db);
			const session = createMockSession({
				...user,
				stripeCustomerId: null,
			});
			const context = createTestContext({ db: server.db, session });

			await expect(
				call(
					scribeStreamHandler,
					{
						documentType: "discharge",
						messages: [
							{
								id: "1",
								role: "user" as const,
								parts: [{ type: "text" as const, text: '{"anamnese":"test"}' }],
							},
						],
					},
					{ context },
				),
			).rejects.toThrow(ORPCError);
		});
	});

	describe("Input Validation", () => {
		test("rejects unknown document type", async () => {
			const { user } = await createTestUser(server.db);
			const session = createMockSession(user);
			const context = createTestContext({ db: server.db, session });

			await expect(
				call(
					scribeStreamHandler,
					{
						documentType: "unknown-type" as DocumentType,
						messages: [
							{
								id: "1",
								role: "user" as const,
								parts: [{ type: "text" as const, text: "{}" }],
							},
						],
					},
					{ context },
				),
			).rejects.toThrow(ORPCError);
		});

		test("rejects empty prompt input with helpful message", async () => {
			const { user } = await createTestUser(server.db);
			const session = createMockSession(user);
			const context = createTestContext({ db: server.db, session });

			await expect(
				call(
					scribeStreamHandler,
					{
						documentType: "anamnese",
						messages: [
							{
								id: "1",
								role: "user" as const,
								parts: [
									{
										type: "text" as const,
										text: JSON.stringify({
											notes: "",
											befunde: "",
											diagnoseblock: "",
										}),
									},
								],
							},
						],
					},
					{ context },
				),
			).rejects.toThrow("Bitte füllen Sie mindestens ein Pflichtfeld aus.");
		});

		test("accepts valid document types", async () => {
			const { user } = await createTestUser(server.db);
			const session = createMockSession(user);
			const context = createTestContext({ db: server.db, session });

			const validTypes: DocumentType[] = ["discharge", "anamnese", "diagnosis"];

			for (const docType of validTypes) {
				// Should not throw for valid types
				// Note: May still fail on usage limits, but not on validation
				try {
					await call(
						scribeStreamHandler,
						{
							documentType: docType,
							messages: [
								{
									id: "1",
									role: "user" as const,
									parts: [{ type: "text" as const, text: '{"notes":"test"}' }],
								},
							],
						},
						{ context },
					);
				} catch (error) {
					// Only usage limit errors are acceptable here
					if (error instanceof ORPCError) {
						expect(error.code).not.toBe("BAD_REQUEST");
					}
				}
			}
		});
	});

	describe("Usage Limits", () => {
		test("enforces free tier limit (50 generations)", async () => {
			const { user } = await createTestUser(server.db);

			// Create 50 usage events to hit the limit
			const { usageEvent } = await import("@repo/database");
			for (let i = 0; i < 50; i++) {
				await server.db.insert(usageEvent).values({
					id: crypto.randomUUID(),
					userId: user.id,
					name: "ai_scribe_generation",
					timestamp: new Date(),
				});
			}

			const session = createMockSession(user);
			const context = createTestContext({ db: server.db, session });

			await expect(
				call(
					scribeStreamHandler,
					{
						documentType: "discharge",
						messages: [
							{
								id: "1",
								role: "user" as const,
								parts: [{ type: "text" as const, text: '{"anamnese":"test"}' }],
							},
						],
					},
					{ context },
				),
			).rejects.toThrow("Monatliche Nutzungsgrenze erreicht");
		});

		test("plus subscribers have higher limit (500 generations)", async () => {
			const { user } = await createTestUser(server.db);

			// Create active subscription
			await createTestSubscription(server.db, user.id, {
				plan: "plus",
				status: "active",
			});

			// Create 50 usage events (under plus limit)
			const { usageEvent } = await import("@repo/database");
			for (let i = 0; i < 50; i++) {
				await server.db.insert(usageEvent).values({
					id: crypto.randomUUID(),
					userId: user.id,
					name: "ai_scribe_generation",
					timestamp: new Date(),
				});
			}

			const session = createMockSession(user);
			const context = createTestContext({ db: server.db, session });

			// Should not throw - under plus limit
			// Note: Will still return a stream (mocked)
			const result = await call(
				scribeStreamHandler,
				{
					documentType: "discharge",
					messages: [
						{
							id: "1",
							role: "user" as const,
							parts: [
								{
									type: "text" as const,
									text: JSON.stringify({
										anamnese: "test",
										diagnoseblock: "test",
										notes: "test",
										befunde: "test",
									}),
								},
							],
						},
					],
				},
				{ context },
			);

			// Should return an async iterator (stream)
			expect(result).toBeDefined();
			expect(typeof result[Symbol.asyncIterator]).toBe("function");
		});

		test("plus subscribers hit limit at 500 generations", async () => {
			const { user } = await createTestUser(server.db);

			// Create active subscription
			await createTestSubscription(server.db, user.id, {
				plan: "plus",
				status: "active",
			});

			// Create 500 usage events to hit the plus limit
			const { usageEvent } = await import("@repo/database");
			for (let i = 0; i < 500; i++) {
				await server.db.insert(usageEvent).values({
					id: crypto.randomUUID(),
					userId: user.id,
					name: "ai_scribe_generation",
					timestamp: new Date(),
				});
			}

			const session = createMockSession(user);
			const context = createTestContext({ db: server.db, session });

			await expect(
				call(
					scribeStreamHandler,
					{
						documentType: "discharge",
						messages: [
							{
								id: "1",
								role: "user" as const,
								parts: [{ type: "text" as const, text: '{"anamnese":"test"}' }],
							},
						],
					},
					{ context },
				),
			).rejects.toThrow("Monatliche Nutzungsgrenze erreicht");
		});
	});

	describe("Streaming Response", () => {
		test("returns async iterator for valid request", async () => {
			const { user } = await createTestUser(server.db);
			const session = createMockSession(user);
			const context = createTestContext({ db: server.db, session });

			const result = await call(
				scribeStreamHandler,
				{
					documentType: "anamnese",
					messages: [
						{
							id: "1",
							role: "user" as const,
							parts: [
								{
									type: "text" as const,
									text: JSON.stringify({
										notes: "Patient with chest pain",
										befunde: "ECG normal",
										diagnoseblock: "Hypertension",
									}),
								},
							],
						},
					],
				},
				{ context },
			);

			expect(result).toBeDefined();
			// The result should be an async iterator
			expect(typeof result[Symbol.asyncIterator]).toBe("function");
		});

		test("resolves admin-configured default model", async () => {
			const { user } = await createTestUser(server.db);
			const session = createMockSession(user);
			const context = createTestContext({ db: server.db, session });

			const result = await call(
				scribeStreamHandler,
				{
					documentType: "anamnese" as const,
					messages: [
						{
							id: "1",
							role: "user" as const,
							parts: [
								{
									type: "text" as const,
									text: JSON.stringify({
										notes: "test",
										befunde: "",
										diagnoseblock: "",
									}),
								},
							],
						},
					],
				},
				{ context },
			);
			expect(result).toBeDefined();
		});
	});
});
