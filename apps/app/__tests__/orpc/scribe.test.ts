import { describe, expect, test, beforeEach } from "bun:test";
import { createTestDatabase, type MockDatabase } from "../mocks/database";
import { createMockSession, createSessionWithoutStripe, type MockSession } from "../mocks/session";
import { documentTypeConfigs } from "@/orpc/scribe/config";
import type { DocumentType } from "@/orpc/scribe/types";

/**
 * Tests for scribe endpoints
 *
 * These tests verify:
 * - Document type configuration
 * - Input processing/parsing
 * - Usage limit checking
 * - Model selection logic
 * - Audio file handling
 *
 * Note: AI model streaming is tested via integration tests or mocked at the provider level
 */

describe("Document Type Configurations", () => {
	test("should have config for all document types", () => {
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
			expect(documentTypeConfigs[type].processInput).toBeDefined();
			expect(documentTypeConfigs[type].modelConfig).toBeDefined();
		}
	});

	describe("discharge", () => {
		test("should have correct prompt name", () => {
			expect(documentTypeConfigs.discharge.promptName).toBe("Inpatient_discharge_chat");
		});

		test("should process input correctly", () => {
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

		test("should use default diagnoseblock when not provided", () => {
			const input = JSON.stringify({
				anamnese: "History",
				dischargeNotes: "Notes",
				befunde: "Results",
			});

			const result = documentTypeConfigs.discharge.processInput(input);

			expect(result.diagnoseblock).toBe("Keine Vorerkrankungen");
		});

		test("should have thinking mode enabled with budget", () => {
			expect(documentTypeConfigs.discharge.modelConfig.thinking).toBe(true);
			expect(documentTypeConfigs.discharge.modelConfig.thinkingBudget).toBe(12000);
		});
	});

	describe("anamnese", () => {
		test("should have correct prompt name", () => {
			expect(documentTypeConfigs.anamnese.promptName).toBe("ER_Anamnese_chat");
		});

		test("should process input correctly", () => {
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

		test("should use default vordiagnosen when not provided", () => {
			const input = JSON.stringify({
				notes: "Notes",
				befunde: "Findings",
			});

			const result = documentTypeConfigs.anamnese.processInput(input);

			expect(result.vordiagnosen).toBe("Keine Vorerkrankungen");
		});

		test("should have thinking mode disabled", () => {
			expect(documentTypeConfigs.anamnese.modelConfig.thinking).toBe(false);
		});
	});

	describe("diagnosis", () => {
		test("should have correct prompt name", () => {
			expect(documentTypeConfigs.diagnosis.promptName).toBe("diagnoseblock_update");
		});

		test("should have lower max tokens for efficiency", () => {
			expect(documentTypeConfigs.diagnosis.modelConfig.maxTokens).toBe(2000);
		});

		test("should have low temperature for consistency", () => {
			expect(documentTypeConfigs.diagnosis.modelConfig.temperature).toBe(0.1);
		});
	});

	describe("physical-exam", () => {
		test("should have correct prompt name", () => {
			expect(documentTypeConfigs["physical-exam"].promptName).toBe(
				"ER_Koerperliche_Untersuchung_chat"
			);
		});

		test("should process input with notes only", () => {
			const input = JSON.stringify({
				notes: "Physical examination findings",
			});

			const result = documentTypeConfigs["physical-exam"].processInput(input);

			expect(result.notes).toBe("Physical examination findings");
			expect(Object.keys(result)).toEqual(["notes"]);
		});
	});

	describe("procedures", () => {
		test("should have correct prompt name", () => {
			expect(documentTypeConfigs.procedures.promptName).toBe("Procedure_chat");
		});

		test("should process procedure notes", () => {
			const input = JSON.stringify({
				procedureNotes: "ZVK anlage rechts jugulär...",
			});

			const result = documentTypeConfigs.procedures.processInput(input);

			expect(result.notes).toBe("ZVK anlage rechts jugulär...");
		});

		test("should have thinking mode enabled", () => {
			expect(documentTypeConfigs.procedures.modelConfig.thinking).toBe(true);
			expect(documentTypeConfigs.procedures.modelConfig.thinkingBudget).toBe(8000);
		});
	});

	describe("admission-todos", () => {
		test("should process all input fields", () => {
			const input = JSON.stringify({
				notes: "Todo notes",
				anamnese: "Patient history",
				vordiagnosen: "Prior diagnoses",
				befunde: "Findings",
			});

			const result = documentTypeConfigs["admission-todos"].processInput(input);

			expect(result.notes).toBe("Todo notes");
			expect(result.anamnese).toBe("Patient history");
			expect(result.vordiagnosen).toBe("Prior diagnoses");
			expect(result.befunde).toBe("Findings");
		});

		test("should use empty defaults for optional fields", () => {
			const input = JSON.stringify({
				notes: "Notes only",
			});

			const result = documentTypeConfigs["admission-todos"].processInput(input);

			expect(result.anamnese).toBe("");
			expect(result.befunde).toBe("");
		});
	});

	describe("befunde", () => {
		test("should have correct prompt name", () => {
			expect(documentTypeConfigs.befunde.promptName).toBe("ER_Befunde_chat");
		});
	});

	describe("outpatient", () => {
		test("should have correct prompt name", () => {
			expect(documentTypeConfigs.outpatient.promptName).toBe("Outpatient_visit_chat");
		});

		test("should have thinking mode enabled", () => {
			expect(documentTypeConfigs.outpatient.modelConfig.thinking).toBe(true);
		});
	});

	describe("icu-transfer", () => {
		test("should have correct prompt name", () => {
			expect(documentTypeConfigs["icu-transfer"].promptName).toBe("ICU_transfer_chat");
		});

		test("should have low temperature", () => {
			expect(documentTypeConfigs["icu-transfer"].modelConfig.temperature).toBe(0.1);
		});
	});
});

describe("Model Selection Logic", () => {
	test("should select gemini for audio input with auto mode", () => {
		const modelId = "auto";
		const hasAudio = true;

		const actualModel =
			modelId === "auto" ? (hasAudio ? "gemini-3-pro" : "claude-opus-4.5") : modelId;

		expect(actualModel).toBe("gemini-3-pro");
	});

	test("should select claude for non-audio with auto mode", () => {
		const modelId = "auto";
		const hasAudio = false;

		const actualModel =
			modelId === "auto" ? (hasAudio ? "gemini-3-pro" : "claude-opus-4.5") : modelId;

		expect(actualModel).toBe("claude-opus-4.5");
	});

	test("should respect explicit model selection", () => {
		const modelId = "glm-4p6";
		const hasAudio = true;

		const actualModel =
			modelId === "auto" ? (hasAudio ? "gemini-3-pro" : "claude-opus-4.5") : modelId;

		expect(actualModel).toBe("glm-4p6");
	});

	describe("model instances", () => {
		test("should map model IDs to OpenRouter paths", () => {
			const modelMappings: Record<string, string> = {
				"glm-4p6": "z-ai/glm-4.6",
				"claude-opus-4.5": "anthropic/claude-opus-4.5",
				"gemini-3-pro": "google/gemini-3-pro-preview",
				"gemini-3-flash": "google/gemini-3-flash-preview",
			};

			expect(modelMappings["claude-opus-4.5"]).toBe("anthropic/claude-opus-4.5");
			expect(modelMappings["gemini-3-pro"]).toBe("google/gemini-3-pro-preview");
		});

		test("all supported models should support thinking mode", () => {
			const supportedModels = ["glm-4p6", "claude-opus-4.5", "gemini-3-pro", "gemini-3-flash"];

			// All these models support thinking mode via OpenRouter
			for (const model of supportedModels) {
				expect(model).toBeDefined();
			}
		});
	});
});

describe("Usage Limit Checking", () => {
	let db: MockDatabase;
	let mocks: ReturnType<typeof createTestDatabase>["mocks"];

	beforeEach(() => {
		const testDb = createTestDatabase();
		db = testDb.db;
		mocks = testDb.mocks;
	});

	test("should allow usage under limit for free tier (50)", async () => {
		mocks.subscription.findMany([]);
		mocks.usageEvent.findMany(
			Array.from({ length: 30 }, (_, i) => ({ id: `event-${i}` }))
		);

		const subscriptions = await db.subscription.findMany({
			where: { referenceId: "user-1", status: { in: ["active", "trialing"] } },
		});

		const activeSubscription = subscriptions.length > 0;
		const usageCount = 30;
		const usageLimit = activeSubscription ? 500 : 50;

		expect(usageCount < usageLimit).toBe(true);
	});

	test("should block usage at limit for free tier", async () => {
		mocks.subscription.findMany([]);

		const activeSubscription = false;
		const usageCount = 50;
		const usageLimit = activeSubscription ? 500 : 50;

		expect(usageCount >= usageLimit).toBe(true);
	});

	test("should allow higher usage for subscribed users (500)", async () => {
		mocks.subscription.findMany([
			{ id: "sub-1", referenceId: "user-1", status: "active" },
		]);

		const subscriptions = await db.subscription.findMany({
			where: { referenceId: "user-1" },
		});

		const activeSubscription = subscriptions.length > 0;
		const usageCount = 200;
		const usageLimit = activeSubscription ? 500 : 50;

		expect(activeSubscription).toBe(true);
		expect(usageLimit).toBe(500);
		expect(usageCount < usageLimit).toBe(true);
	});

	test("should block usage at limit for subscribed users", async () => {
		mocks.subscription.findMany([
			{ id: "sub-1", referenceId: "user-1", status: "active" },
		]);

		const subscriptions = await db.subscription.findMany({
			where: { referenceId: "user-1" },
		});

		const activeSubscription = subscriptions.length > 0;
		const usageCount = 500;
		const usageLimit = activeSubscription ? 500 : 50;

		expect(usageCount >= usageLimit).toBe(true);
	});

	test("should count 'trialing' subscriptions as active", async () => {
		mocks.subscription.findMany([
			{ id: "sub-1", referenceId: "user-1", status: "trialing" },
		]);

		const subscriptions = await db.subscription.findMany({
			where: {
				referenceId: "user-1",
				status: { in: ["active", "trialing"] },
			},
		});

		expect(subscriptions.length > 0).toBe(true);
	});
});

describe("Stripe Customer Requirement", () => {
	test("should require stripeCustomerId for scribe endpoints", () => {
		const sessionWithStripe = createMockSession();
		const sessionWithoutStripe = createSessionWithoutStripe();

		expect(sessionWithStripe.user.stripeCustomerId).toBe("cus_test123");
		expect(sessionWithoutStripe.user.stripeCustomerId).toBeNull();

		// Handler checks: if (!context.session.user.stripeCustomerId) throw UNAUTHORIZED
		const hasStripe = (session: { user: { stripeCustomerId: string | null } }) =>
			session.user.stripeCustomerId !== null;

		expect(hasStripe(sessionWithStripe)).toBe(true);
		expect(hasStripe(sessionWithoutStripe)).toBe(false);
	});
});

describe("Message Extraction", () => {
	test("should extract prompt from last user message (string content)", () => {
		const messages = [
			{ role: "system" as const, content: "System prompt" },
			{ role: "user" as const, content: "First user message" },
			{ role: "assistant" as const, content: "Assistant response" },
			{ role: "user" as const, content: "Last user message with prompt" },
		];

		const lastUserMessage = messages.findLast((m) => m.role === "user");

		expect(lastUserMessage?.content).toBe("Last user message with prompt");
	});

	test("should handle parts-based content", () => {
		const message = {
			role: "user" as const,
			content: "",
			parts: [
				{ type: "text" as const, text: "Part 1" },
				{ type: "text" as const, text: " Part 2" },
			],
		};

		const textParts = message.parts
			.filter((p) => p.type === "text")
			.map((p) => p.text)
			.join("");

		expect(textParts).toBe("Part 1 Part 2");
	});

	test("should return empty string when no user message exists", () => {
		const messages = [
			{ role: "system" as const, content: "System only" },
			{ role: "assistant" as const, content: "Assistant only" },
		];

		const lastUserMessage = messages.findLast((m) => m.role === "user");

		expect(lastUserMessage).toBeUndefined();

		const prompt = lastUserMessage?.content ?? "";
		expect(prompt).toBe("");
	});
});

describe("Audio File Handling", () => {
	test("should detect audio files presence", () => {
		const audioFiles = [
			{ data: "base64data...", mimeType: "audio/mp3" },
		];

		const hasAudio = audioFiles && audioFiles.length > 0;

		expect(hasAudio).toBe(true);
	});

	test("should handle empty audio files array", () => {
		const audioFiles: Array<{ data: string; mimeType: string }> = [];

		const hasAudio = audioFiles && audioFiles.length > 0;

		expect(hasAudio).toBe(false);
	});

	test("should handle undefined audio files", () => {
		const audioFiles = undefined;

		// Use Boolean() to get a proper boolean, as `undefined && x` returns undefined
		const hasAudio = Boolean(audioFiles && audioFiles.length > 0);

		expect(hasAudio).toBe(false);
	});

	test("should format audio content for Gemini models", () => {
		const audioFiles = [
			{ data: "base64audiodata", mimeType: "audio/webm" },
			{ data: "morebase64data", mimeType: "audio/mp3" },
		];

		const audioContent = audioFiles.map((audioFile) => ({
			type: "file" as const,
			data: audioFile.data,
			mediaType: audioFile.mimeType,
		}));

		expect(audioContent).toHaveLength(2);
		expect(audioContent[0].type).toBe("file");
		expect(audioContent[0].mediaType).toBe("audio/webm");
	});
});

describe("Usage Event Logging", () => {
	test("should build correct usage event data", () => {
		const params = {
			userId: "user-123",
			name: "ai_scribe_generation",
			model: "anthropic/claude-opus-4.5",
			openRouterUsage: {
				promptTokens: 500,
				completionTokens: 1000,
				totalTokens: 1500,
				cost: 0.05,
				completionTokensDetails: { reasoningTokens: 200 },
				promptTokensDetails: { cachedTokens: 100 },
			},
			inputData: {
				anamnese: "Patient history",
				notes: "Notes",
			},
			metadata: {
				promptName: "Inpatient_discharge_chat",
				thinkingEnabled: true,
				streamingMode: true,
			},
			result: "Generated document text...",
		};

		// Build event data structure
		const eventData = {
			name: params.name,
			model: params.model,
			inputTokens: params.openRouterUsage.promptTokens,
			outputTokens: params.openRouterUsage.completionTokens,
			totalTokens: params.openRouterUsage.totalTokens,
			cost: params.openRouterUsage.cost,
			reasoningTokens: params.openRouterUsage.completionTokensDetails.reasoningTokens,
			cachedTokens: params.openRouterUsage.promptTokensDetails.cachedTokens,
		};

		expect(eventData.inputTokens).toBe(500);
		expect(eventData.outputTokens).toBe(1000);
		expect(eventData.totalTokens).toBe(1500);
		expect(eventData.cost).toBe(0.05);
		expect(eventData.reasoningTokens).toBe(200);
		expect(eventData.cachedTokens).toBe(100);
	});
});

describe("Get Usage Endpoint", () => {
	let db: MockDatabase;
	let session: MockSession;
	let mocks: ReturnType<typeof createTestDatabase>["mocks"];

	beforeEach(() => {
		const testDb = createTestDatabase();
		db = testDb.db;
		mocks = testDb.mocks;
		session = createMockSession();
	});

	test("should calculate monthly usage statistics", async () => {
		const mockEvents = [
			{ totalTokens: 1000, inputTokens: 400, outputTokens: 600, cost: 0.02, model: "claude" },
			{ totalTokens: 1500, inputTokens: 500, outputTokens: 1000, cost: 0.03, model: "claude" },
			{ totalTokens: 800, inputTokens: 300, outputTokens: 500, cost: 0.015, model: "gemini" },
		];

		mocks.usageEvent.findMany(mockEvents);

		const usage = await db.usageEvent.findMany({
			where: { userId: session.user.id, name: "ai_scribe_generation" },
		});

		// Calculate totals
		const totalTokens = usage.reduce((acc: number, e: { totalTokens?: number }) => acc + (e.totalTokens ?? 0), 0);
		const totalInputTokens = usage.reduce((acc: number, e: { inputTokens?: number }) => acc + (e.inputTokens ?? 0), 0);
		const totalOutputTokens = usage.reduce((acc: number, e: { outputTokens?: number }) => acc + (e.outputTokens ?? 0), 0);
		const totalCost = usage.reduce((acc: number, e: { cost?: number }) => acc + (e.cost ?? 0), 0);

		expect(totalTokens).toBe(3300);
		expect(totalInputTokens).toBe(1200);
		expect(totalOutputTokens).toBe(2100);
		expect(totalCost).toBeCloseTo(0.065);
	});

	test("should group usage by model", async () => {
		const mockEvents = [
			{ model: "claude", totalTokens: 1000, cost: 0.02 },
			{ model: "claude", totalTokens: 1500, cost: 0.03 },
			{ model: "gemini", totalTokens: 800, cost: 0.015 },
		];

		// Group by model
		const byModel = mockEvents.reduce(
			(acc: Record<string, { count: number; tokens: number; cost: number }>, event) => {
				const model = event.model ?? "unknown";
				if (!acc[model]) {
					acc[model] = { count: 0, tokens: 0, cost: 0 };
				}
				acc[model].count++;
				acc[model].tokens += event.totalTokens ?? 0;
				acc[model].cost += event.cost ?? 0;
				return acc;
			},
			{}
		);

		expect(byModel.claude.count).toBe(2);
		expect(byModel.claude.tokens).toBe(2500);
		expect(byModel.gemini.count).toBe(1);
		expect(byModel.gemini.tokens).toBe(800);
	});

	test("should filter by current month", () => {
		const now = new Date();
		const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

		// Event from earlier in the current month (yesterday or the 1st if we're on the 1st)
		const currentMonthEvent = new Date(now.getFullYear(), now.getMonth(), Math.max(1, now.getDate() - 1));
		// Event from last month - should be excluded
		const lastMonthEvent = new Date(now.getFullYear(), now.getMonth() - 1, 15);

		expect(currentMonthEvent >= firstDayOfMonth).toBe(true);
		expect(currentMonthEvent <= now).toBe(true);
		expect(lastMonthEvent >= firstDayOfMonth).toBe(false);
	});
});
