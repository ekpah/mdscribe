import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { ORPCError, call } from "@orpc/server";
import { aiDefaults, aiModel, aiProvider } from "@repo/database";
import { USER_MESSAGES } from "@/lib/user-messages";
import { documentTypeConfigs } from "@/orpc/scribe/config";
import { composeScribeContext } from "@/orpc/scribe/context";
import { scribeStreamHandler } from "@/orpc/scribe/handlers";
import { DEFAULT_SCRIBE_MODEL_CONFIG } from "@/orpc/scribe/handlers/scribe-stream";
import { resolveModel } from "@/orpc/scribe/providers";
import type { DocumentType } from "@/orpc/scribe/types";
import type { TestServer } from "@/__tests__/setup";
import {
	createMockSession,
	createTestAiDefaults,
	createTestContext,
	createTestSubscription,
	createTestUser,
	startTestServer,
} from "@/__tests__/setup";

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
			"procedures",
			"befunde",
			"outpatient",
			"icu-transfer",
		];

		for (const type of documentTypes) {
			expect(documentTypeConfigs[type]).toBeDefined();
			expect(documentTypeConfigs[type].promptName).toBeDefined();
		}
	});

	test("uses one default model config for all scribe generations", () => {
		expect(DEFAULT_SCRIBE_MODEL_CONFIG).toEqual({
			maxTokens: 20_000,
			temperature: 0.3,
			thinking: false,
			thinkingBudget: 8000,
		});
	});
});

describe("Context Builder", () => {
	test("builds unified context envelope with patient sections and omits empty tags", async () => {
		const { contextXml } = await composeScribeContext({
			formData: {
				anamnese: "Akute Dyspnoe",
				diagnoseblock: "I10 Hypertonie",
				notes: "Zusätzliche Notizen",
			},
			sessionUser: null,
		});

		expect(contextXml).toContain("<context>");
		expect(contextXml).toContain("<patient_context>");
		expect(contextXml).toContain("<diagnoseblock>");
		expect(contextXml).toContain("<anamnese>");
		expect(contextXml).toContain("<notizen>");
		expect(contextXml).not.toContain("<befunde>");
	});

	test("includes user_context when name is provided", async () => {
		const session = createMockSession({
			email: "doctor@test.com",
			id: crypto.randomUUID(),
			name: "Dr. Test",
		});
		const { contextXml } = await composeScribeContext({
			formData: {},
			sessionUser: session.user,
		});

		expect(contextXml).toContain("<context>");
		expect(contextXml).toContain("<user_context>");
		expect(contextXml).toContain("<name>Dr. Test</name>");
	});

	test("emits template_context with template content and examples", async () => {
		const { contextXml } = await composeScribeContext({
			formData: {},
			sessionUser: null,
			template: {
				content: "## Abschnitt",
				examples: ["Beispiel A", "Beispiel B"],
				title: "ER Vorlage",
			},
		});

		expect(contextXml).toContain("<template_context>");
		expect(contextXml).toContain("<title>\nER Vorlage\n</title>");
		expect(contextXml).toContain("<content>\n## Abschnitt\n</content>");
		expect(contextXml).toContain("<example>\nBeispiel A\n</example>");
		expect(contextXml).toContain("<example>\nBeispiel B\n</example>");
		expect(contextXml).toContain("<context>");
	});

	test("uses fallback template when promptContextKey is set and no explicit template exists", async () => {
		const { contextXml } = await composeScribeContext({
			formData: { notes: "Kurznotiz" },
			promptContextKey: "discharge",
			sessionUser: null,
		});

		expect(contextXml).toContain("<template_context>");
		expect(contextXml).toContain("Standardstruktur Entlassbrief");
		expect(contextXml.indexOf("<template_context>")).toBeLessThan(
			contextXml.indexOf("<patient_context>"),
		);
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
				apiKey: null,
				baseUrl: null,
				id: providerId,
				name: "Test Provider",
				protocol: "openrouter",
			});
			await server.db.insert(aiModel).values([
				{
					displayName: "Text Model",
					id: textModelRecordId,
					inputModes: ["text"],
					modelId: "openrouter/test-text",
					providerId,
					supportsReasoning: false,
				},
				{
					displayName: "Speech Model",
					id: speechModelRecordId,
					inputModes: ["text", "audio"],
					modelId: "openrouter/test-speech",
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
				apiKey: null,
				baseUrl: null,
				id: providerId,
				name: "Test Provider",
				protocol: "openrouter",
			});
			await server.db.insert(aiModel).values({
				displayName: "Text Model",
				id: textModelRecordId,
				inputModes: ["text"],
				modelId: "openrouter/test-text",
				providerId,
				supportsReasoning: false,
			});
			await server.db
				.insert(aiDefaults)
				.values({
					defaultFileImageModelId: textModelRecordId,
					defaultSpeechToTextModelId: null,
					defaultTextModelId: textModelRecordId,
					id: "global",
					updatedAt: new Date(),
				})
				.onConflictDoUpdate({
					set: {
						defaultFileImageModelId: textModelRecordId,
						defaultSpeechToTextModelId: null,
						defaultTextModelId: textModelRecordId,
						updatedAt: new Date(),
					},
					target: aiDefaults.id,
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
		await server?.close();
	});

	describe("Authentication & Authorization", () => {
		test("allows free-tier users without stripeCustomerId", async () => {
			const { user } = await createTestUser(server.db);
			const session = createMockSession({
				...user,
				stripeCustomerId: null,
			});
			const context = createTestContext({ db: server.db, session });

			const result = await call(
				scribeStreamHandler,
				{
					documentType: "discharge",
					messages: [
						{
							id: "1",
							parts: [{ text: '{"anamnese":"test"}', type: "text" as const }],
							role: "user" as const,
						},
					],
				},
				{ context },
			);

			expect(result).toBeDefined();
			expect(typeof result[Symbol.asyncIterator]).toBe("function");
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
									parts: [{ text: "{}", type: "text" as const }],
									role: "user" as const,
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
									parts: [
										{
											text: JSON.stringify({
												befunde: "",
												diagnoseblock: "",
												notes: "",
											}),
											type: "text" as const,
										},
									],
									role: "user" as const,
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
									parts: [{ text: '{"notes":"test"}', type: "text" as const }],
									role: "user" as const,
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
			for (let i = 0; i < 50; i += 1) {
				await server.db.insert(usageEvent).values({
					id: crypto.randomUUID(),
					name: "ai_scribe_generation",
					timestamp: new Date(),
					userId: user.id,
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
									parts: [{ text: '{"anamnese":"test"}', type: "text" as const }],
									role: "user" as const,
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
			for (let i = 0; i < 50; i += 1) {
				await server.db.insert(usageEvent).values({
					id: crypto.randomUUID(),
					name: "ai_scribe_generation",
					timestamp: new Date(),
					userId: user.id,
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
								parts: [
									{
										text: JSON.stringify({
											anamnese: "test",
											befunde: "test",
											diagnoseblock: "test",
											notes: "test",
										}),
										type: "text" as const,
									},
								],
								role: "user" as const,
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
			for (let i = 0; i < 500; i += 1) {
				await server.db.insert(usageEvent).values({
					id: crypto.randomUUID(),
					name: "ai_scribe_generation",
					timestamp: new Date(),
					userId: user.id,
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
									parts: [{ text: '{"anamnese":"test"}', type: "text" as const }],
									role: "user" as const,
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
								parts: [
									{
										text: JSON.stringify({
											befunde: "ECG normal",
											diagnoseblock: "Hypertension",
											notes: "Patient with chest pain",
										}),
										type: "text" as const,
									},
								],
								role: "user" as const,
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
								parts: [
									{
										text: JSON.stringify({
											befunde: "",
											diagnoseblock: "",
											notes: "test",
										}),
										type: "text" as const,
									},
								],
								role: "user" as const,
							},
						],
					},
				{ context },
			);
			expect(result).toBeDefined();
		});
	});
});
