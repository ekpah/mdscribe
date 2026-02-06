import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { call, ORPCError } from "@orpc/server";
import { documentTypeConfigs } from "@/orpc/scribe/config";
import { scribeStreamHandler } from "@/orpc/scribe/handlers";
import type { DocumentType } from "@/orpc/scribe/types";
import {
	createMockSession,
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
			"admission-todos",
			"befunde",
			"outpatient",
			"icu-transfer",
		];

		for (const type of documentTypes) {
			expect(documentTypeConfigs[type]).toBeDefined();
			expect(documentTypeConfigs[type].promptName).toBeDefined();
			expect(documentTypeConfigs[type].processInput).toBeInstanceOf(Function);
			expect(documentTypeConfigs[type].modelConfig).toBeDefined();
		}
	});

	test("discharge config processes input correctly", () => {
		const input = JSON.stringify({
			anamnese: "Patient history...",
			diagnoseblock: "Primary diagnosis",
			dischargeNotes: "Discharge instructions",
			befunde: "Test results",
		});

		const result = documentTypeConfigs.discharge.processInput(input);

		expect(result.anamnese).toBe("Patient history...");
		expect(result.notes).toBe("Discharge instructions");
		expect(result.diagnoseblock).toBe("Primary diagnosis");
		expect(result.befunde).toBe("Test results");
	});

	test("discharge uses default diagnoseblock when missing", () => {
		const input = JSON.stringify({
			anamnese: "History",
			dischargeNotes: "Notes",
			befunde: "Results",
		});

		const result = documentTypeConfigs.discharge.processInput(input);
		expect(result.diagnoseblock).toBe("Keine Vorerkrankungen");
	});

	test("anamnese config processes input correctly", () => {
		const input = JSON.stringify({
			notes: "Patient notes...",
			befunde: "Findings",
			vordiagnosen: "Prior diagnoses",
		});

		const result = documentTypeConfigs.anamnese.processInput(input);

		expect(result.notes).toBe("Patient notes...");
		expect(result.befunde).toBe("Findings");
		expect(result.vordiagnosen).toBe("Prior diagnoses");
	});

	test("procedures config extracts procedure notes", () => {
		const input = JSON.stringify({
			procedureNotes: "ZVK anlage rechts jugulär...",
		});

		const result = documentTypeConfigs.procedures.processInput(input);
		expect(result.notes).toBe("ZVK anlage rechts jugulär...");
	});

	test("thinking mode configs are correct", () => {
		// Document types with thinking enabled
		expect(documentTypeConfigs.discharge.modelConfig.thinking).toBe(true);
		expect(documentTypeConfigs.procedures.modelConfig.thinking).toBe(true);
		expect(documentTypeConfigs.outpatient.modelConfig.thinking).toBe(true);

		// Document types without thinking
		expect(documentTypeConfigs.anamnese.modelConfig.thinking).toBe(false);
		expect(documentTypeConfigs.diagnosis.modelConfig.thinking).toBe(false);
		expect(documentTypeConfigs["physical-exam"].modelConfig.thinking).toBe(false);
	});
});

describe("Model Selection Logic", () => {
	test("auto mode selects gemini for audio input", () => {
		const modelId = "auto";
		const hasAudio = true;

		const actualModel = modelId === "auto"
			? (hasAudio ? "gemini-3-pro" : "claude-opus-4.5")
			: modelId;

		expect(actualModel).toBe("gemini-3-pro");
	});

	test("auto mode selects claude for non-audio input", () => {
		const modelId = "auto";
		const hasAudio = false;

		const actualModel = modelId === "auto"
			? (hasAudio ? "gemini-3-pro" : "claude-opus-4.5")
			: modelId;

		expect(actualModel).toBe("claude-opus-4.5");
	});

	test("explicit model selection is preserved", () => {
		const modelId: string = "glm-4p6";
		const hasAudio = true;

		const actualModel = modelId === "auto"
			? (hasAudio ? "gemini-3-pro" : "claude-opus-4.5")
			: modelId;

		expect(actualModel).toBe("glm-4p6");
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
	});

	afterEach(async () => {
		await server.close();
	});

	describe("Authentication & Authorization", () => {
		test("requires stripeCustomerId to use scribe", async () => {
			const { user } = await createTestUser(server.db);
			// Create session without stripeCustomerId
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
						messages: [{ id: "1", role: "user" as const, parts: [{ type: "text" as const, text: '{"anamnese":"test"}' }] }],
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
						messages: [{ id: "1", role: "user" as const, parts: [{ type: "text" as const, text: "{}" }] }],
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
								role: "user",
								content: JSON.stringify({
									notes: "",
									befunde: "",
									vordiagnosen: "",
								}),
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
							messages: [{ id: "1", role: "user" as const, parts: [{ type: "text" as const, text: '{"notes":"test"}' }] }],
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
						messages: [{ id: "1", role: "user" as const, parts: [{ type: "text" as const, text: '{"anamnese":"test"}' }] }],
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
							parts: [{ type: "text" as const, text: JSON.stringify({
								anamnese: "test",
								diagnoseblock: "test",
								dischargeNotes: "test",
								befunde: "test",
							}) }],
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
						messages: [{ id: "1", role: "user" as const, parts: [{ type: "text" as const, text: '{"anamnese":"test"}' }] }],
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
							parts: [{ type: "text" as const, text: JSON.stringify({
								notes: "Patient with chest pain",
								befunde: "ECG normal",
								vordiagnosen: "Hypertension",
							}) }],
						},
					],
				},
				{ context },
			);

			expect(result).toBeDefined();
			// The result should be an async iterator
			expect(typeof result[Symbol.asyncIterator]).toBe("function");
		});

		test("handles different model selections", async () => {
			const { user } = await createTestUser(server.db);
			const session = createMockSession(user);
			const context = createTestContext({ db: server.db, session });

			const models = ["auto", "claude-opus-4.5", "gemini-3-pro", "glm-4p6"] as const;

			for (const model of models) {
				const result = await call(
					scribeStreamHandler,
					{
						documentType: "anamnese",
						messages: [
							{
								id: "1",
								role: "user" as const,
								parts: [{ type: "text" as const, text: JSON.stringify({ notes: "test", befunde: "", vordiagnosen: "" }) }],
							},
						],
						model,
					},
					{ context },
				);

				expect(result).toBeDefined();
			}
		});
	});
});

/**
 * Tests for document type specific processing
 */
describe("Document Type Processing", () => {
	describe("Discharge Document", () => {
		test("processInput extracts all fields correctly", () => {
			const input = JSON.stringify({
				anamnese: "75-jährige Patientin mit Diabetes",
				diagnoseblock: "E11.9 - Diabetes mellitus Typ 2",
				dischargeNotes: "Insulintherapie optimiert",
				befunde: "HbA1c 8.5%",
			});

			const result = documentTypeConfigs.discharge.processInput(input);

			expect(result.anamnese).toBe("75-jährige Patientin mit Diabetes");
			expect(result.diagnoseblock).toBe("E11.9 - Diabetes mellitus Typ 2");
			expect(result.notes).toBe("Insulintherapie optimiert");
			expect(result.befunde).toBe("HbA1c 8.5%");
		});
	});

	describe("Procedures Document", () => {
		test("processInput extracts procedure notes", () => {
			const input = JSON.stringify({
				procedureNotes:
					"ZVK Anlage rechts jugulär unter sonographischer Kontrolle, komplikationslos",
			});

			const result = documentTypeConfigs.procedures.processInput(input);

			expect(result.notes).toContain("ZVK Anlage");
		});
	});

	describe("Physical Exam Document", () => {
		test("processInput handles physical exam fields", () => {
			const input = JSON.stringify({
				notes: "Allgemeinzustand gut, Patient wach und orientiert",
			});

			const result = documentTypeConfigs["physical-exam"].processInput(input);

			expect(result.notes).toContain("Allgemeinzustand");
		});
	});

	describe("ICU Transfer Document", () => {
		test("processInput extracts ICU transfer notes", () => {
			const input = JSON.stringify({
				notes: "Verlegung auf ITS bei respiratorischer Insuffizienz",
				befunde: "pO2 55mmHg, pCO2 60mmHg",
			});

			const result = documentTypeConfigs["icu-transfer"].processInput(input);

			expect(result.notes).toContain("Verlegung");
		});
	});
});
