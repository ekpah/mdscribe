// Re-export test utilities from the database package
export {
	startTestServer,
	createTestUser,
	type TestServer,
	type TestDatabase,
} from "@repo/database/test";

import type { TestDatabase } from "@repo/database/test";
import type { Session } from "@/lib/auth-types";

/**
 * Admin email addresses (from middlewares/admin.ts)
 */
export const ADMIN_EMAILS = ["nils.hapke@we-mail.de", "n.hapke@bbtgruppe.de"];

/**
 * Creates a test context for oRPC handlers
 * This allows calling handlers directly without HTTP overhead
 */
export function createTestContext(options: {
	db: TestDatabase;
	session?: Session;
}) {
	return {
		db: options.db,
		session: options.session,
	};
}

/**
 * Creates a mock session for authenticated handler tests
 */
export function createMockSession(user: {
	id: string;
	email: string;
	name?: string;
	stripeCustomerId?: string | null;
	emailVerified?: boolean;
}): Session {
	return {
		user: {
			id: user.id,
			email: user.email,
			name: user.name ?? "Test User",
			emailVerified: user.emailVerified ?? true,
			createdAt: new Date(),
			updatedAt: new Date(),
			image: null,
			// Use explicit undefined check to allow passing null to override the default
			stripeCustomerId:
				"stripeCustomerId" in user
					? user.stripeCustomerId
					: `cus_test_${Date.now()}`,
		},
		session: {
			id: crypto.randomUUID(),
			userId: user.id,
			token: crypto.randomUUID(),
			expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
			createdAt: new Date(),
			updatedAt: new Date(),
			ipAddress: "127.0.0.1",
			userAgent: "test-agent",
		},
	};
}

/**
 * Helper to create a template in the test database
 */
export async function createTestTemplate(
	db: TestDatabase,
	authorId: string,
	options?: {
		title?: string;
		category?: string;
		content?: string;
		embedding?: number[];
	},
) {
	const { template } = await import("@repo/database");

	const result = await db
		.insert(template)
		.values({
			id: crypto.randomUUID(),
			title: options?.title ?? "Test Template",
			category: options?.category ?? "Test Category",
			content: options?.content ?? "Test content",
			authorId,
			updatedAt: new Date(),
			embedding: options?.embedding ?? Array.from({ length: 1024 }, () => Math.random()),
		})
		.returning();

	return result[0]!;
}

/**
 * Helper to create a text snippet in the test database
 */
export async function createTestSnippet(
	db: TestDatabase,
	userId: string,
	options?: {
		key?: string;
		snippet?: string;
	},
) {
	const { textSnippet } = await import("@repo/database");

	const result = await db
		.insert(textSnippet)
		.values({
			id: crypto.randomUUID(),
			userId,
			key: options?.key ?? `test-key-${Date.now()}`,
			snippet: options?.snippet ?? "Test snippet content",
		})
		.returning();

	return result[0]!;
}

/**
 * Helper to create a subscription in the test database
 */
export async function createTestSubscription(
	db: TestDatabase,
	userId: string,
	options?: {
		plan?: string;
		status?: string;
	},
) {
	const { subscription } = await import("@repo/database");

	const result = await db
		.insert(subscription)
		.values({
			id: crypto.randomUUID(),
			referenceId: userId,
			plan: options?.plan ?? "plus",
			status: options?.status ?? "active",
			stripeCustomerId: `cus_test_${Date.now()}`,
			stripeSubscriptionId: `sub_test_${Date.now()}`,
			periodStart: new Date(),
			periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
		})
		.returning();

	return result[0]!;
}

/**
 * Helper to create a usage event in the test database
 */
export async function createTestUsageEvent(
	db: TestDatabase,
	userId: string,
	options?: {
		name?: string;
		inputTokens?: number;
		outputTokens?: number;
	},
) {
	const { usageEvent } = await import("@repo/database");

	const result = await db
		.insert(usageEvent)
		.values({
			id: crypto.randomUUID(),
			userId,
			name: options?.name ?? "ai_scribe_generation",
			inputTokens: options?.inputTokens ?? 100,
			outputTokens: options?.outputTokens ?? 200,
			totalTokens: (options?.inputTokens ?? 100) + (options?.outputTokens ?? 200),
			model: "test-model",
			timestamp: new Date(),
		})
		.returning();

	return result[0]!;
}
