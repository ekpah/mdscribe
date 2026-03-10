// Re-export test utilities from the database package
export {
	createTestUser,
	startTestServer,
	type TestDatabase,
	type TestServer,
} from "@repo/database/test";

import type { TestDatabase } from "@repo/database/test";
import type { Session } from "@/lib/auth-types";

type TestSession = Pick<Session, "user">;

/**
 * Admin email address used in tests (matches ADMIN_EMAIL in preload.ts mock)
 */
export const ADMIN_EMAIL = "admin@test.com";

/**
 * Creates a test context for oRPC handlers
 * This allows calling handlers directly without HTTP overhead
 */
export const createTestContext = (options: {
	db: TestDatabase;
	session?: TestSession;
}) => {
	return {
		db: options.db,
		session: options.session,
	};
};

const getRequiredRow = <T,>(rows: T[], message: string): T => {
	const row = rows[0];
	if (!row) {
		throw new Error(message);
	}
	return row;
};

/**
 * Helper to create a template in the test database
 */
export const createTestTemplate = async (
	db: TestDatabase,
	authorId: string,
	options?: {
		title?: string;
		category?: string;
		content?: string;
		embedding?: number[];
	},
) => {
	const { template } = await import("@repo/database");

	const result = await db
		.insert(template)
		.values({
			authorId,
			category: options?.category ?? "Test Category",
			content: options?.content ?? "Test content",
			embedding:
				options?.embedding ?? Array.from({ length: 1024 }, () => Math.random()),
			id: crypto.randomUUID(),
			title: options?.title ?? "Test Template",
			updatedAt: new Date(),
		})
		.returning();

	return getRequiredRow(result, "Failed to create test template");
};

/**
 * Helper to create a text snippet in the test database
 */
export const createTestSnippet = async (
	db: TestDatabase,
	userId: string,
	options?: {
		key?: string;
		snippet?: string;
	},
) => {
	const { textSnippet } = await import("@repo/database");

	const result = await db
		.insert(textSnippet)
		.values({
			id: crypto.randomUUID(),
			key: options?.key ?? `test-key-${Date.now()}`,
			snippet: options?.snippet ?? "Test snippet content",
			userId,
		})
		.returning();

	return getRequiredRow(result, "Failed to create test snippet");
};

/**
 * Helper to create a subscription in the test database
 */
export const createTestSubscription = async (
	db: TestDatabase,
	userId: string,
	options?: {
		plan?: string;
		status?: string;
	},
) => {
	const { subscription } = await import("@repo/database");

	const result = await db
		.insert(subscription)
		.values({
			id: crypto.randomUUID(),
			periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
			periodStart: new Date(),
			plan: options?.plan ?? "plus",
			referenceId: userId,
			status: options?.status ?? "active",
			stripeCustomerId: `cus_test_${Date.now()}`,
			stripeSubscriptionId: `sub_test_${Date.now()}`,
		})
		.returning();

	return getRequiredRow(result, "Failed to create test subscription");
};

/**
 * Helper to create a usage event in the test database
 */
export const createTestUsageEvent = async (
	db: TestDatabase,
	userId: string,
	options?: {
		name?: string;
		inputTokens?: number;
		outputTokens?: number;
	},
) => {
	const { usageEvent } = await import("@repo/database");

	const result = await db
		.insert(usageEvent)
		.values({
			id: crypto.randomUUID(),
			inputTokens: options?.inputTokens ?? 100,
			model: "test-model",
			name: options?.name ?? "ai_scribe_generation",
			outputTokens: options?.outputTokens ?? 200,
			timestamp: new Date(),
			totalTokens:
				(options?.inputTokens ?? 100) + (options?.outputTokens ?? 200),
			userId,
		})
		.returning();

	return getRequiredRow(result, "Failed to create test usage event");
};

/**
 * Seed a minimal provider/model/default setup so resolver-based handlers can run.
 */
export const createTestAiDefaults = async (db: TestDatabase): Promise<{
	providerId: string;
	modelRecordId: string;
	modelId: string;
}> => {
	const { aiDefaults, aiModel, aiProvider } = await import("@repo/database");

	const providerId = crypto.randomUUID();
	const modelRecordId = crypto.randomUUID();
	const modelId = "openrouter/test-model";

	await db.insert(aiProvider).values({
		apiKey: null,
		baseUrl: null,
		id: providerId,
		name: "Test Provider",
		protocol: "openrouter",
	});

	await db.insert(aiModel).values({
		displayName: "Test Model",
		id: modelRecordId,
		inputModes: ["text", "audio", "file", "image"],
		modelId,
		providerId,
		supportsReasoning: true,
	});

	await db
		.insert(aiDefaults)
		.values({
			defaultFileImageModelId: modelRecordId,
			defaultSpeechToTextModelId: modelRecordId,
			defaultTextModelId: modelRecordId,
			id: "global",
			updatedAt: new Date(),
		})
		.onConflictDoUpdate({
			set: {
				defaultFileImageModelId: modelRecordId,
				defaultSpeechToTextModelId: modelRecordId,
				defaultTextModelId: modelRecordId,
				updatedAt: new Date(),
			},
			target: aiDefaults.id,
		});

	return { modelId, modelRecordId, providerId };
};
