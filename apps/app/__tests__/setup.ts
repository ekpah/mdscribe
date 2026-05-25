import {
	createDatabaseClient,
	createSqlClient,
	migrateDatabase,
	type DatabaseWithSchema,
	type SqlClient,
} from "@repo/database/connect";
import { user } from "@repo/database/schema";

import type { Session } from "@/lib/auth-types";

export type TestDatabase = DatabaseWithSchema;

export interface TestServer {
	db: TestDatabase;
	close: () => Promise<void>;
}

const DEFAULT_TEST_DATABASE_URL = "postgres://postgres:postgres@127.0.0.1:5432/mdscribe_test";

const migrationsFolder = new URL("../../../packages/database/drizzle", import.meta.url).pathname;

const allowedTestHosts = new Set([
	"127.0.0.1",
	"::1",
	"localhost",
	"host.docker.internal",
	"postgres",
]);
const preparedDatabases = new Set<string>();

const quoteIdentifier = (value: string): string => `"${value.replaceAll('"', '""')}"`;

const parseConnectionString = (connectionString: string): URL => {
	try {
		return new URL(connectionString);
	} catch {
		throw new Error(
			"Invalid test database URL. Set POSTGRES_DATABASE_URL_TEST to a valid postgres:// URL.",
		);
	}
};

const getDatabaseName = (url: URL): string => url.pathname.replace(/^\//, "");

const normalizeConnectionUrl = (url: URL): string => {
	const databaseName = getDatabaseName(url);
	return [
		url.protocol.replace("postgresql:", "postgres:"),
		"//",
		url.username,
		":",
		url.password,
		"@",
		url.hostname,
		":",
		url.port || "5432",
		"/",
		databaseName,
	].join("");
};

const assertSafeTestConnectionString = (connectionString: string): void => {
	const testUrl = parseConnectionString(connectionString);
	const databaseName = getDatabaseName(testUrl);

	if (!["postgres:", "postgresql:"].includes(testUrl.protocol)) {
		throw new Error(`Refusing to run tests against non-Postgres URL (${testUrl.protocol}).`);
	}

	if (!databaseName) {
		throw new Error("Refusing to run tests without a database name in the URL.");
	}

	if (!/(^|[_-])test($|[_-])/i.test(databaseName)) {
		throw new Error(
			`Refusing to run tests against database "${databaseName}". Test database names must include "test".`,
		);
	}

	if (!allowedTestHosts.has(testUrl.hostname)) {
		throw new Error(
			`Refusing to run tests against host "${testUrl.hostname}". Only local test hosts are allowed.`,
		);
	}

	const appConnection = process.env.POSTGRES_DATABASE_URL;
	if (!appConnection) {
		return;
	}

	const appUrl = parseConnectionString(appConnection);
	if (normalizeConnectionUrl(appUrl) === normalizeConnectionUrl(testUrl)) {
		throw new Error(
			"Refusing to run tests because POSTGRES_DATABASE_URL_TEST matches POSTGRES_DATABASE_URL.",
		);
	}
};

const getTestConnectionString = (): string =>
	process.env.POSTGRES_DATABASE_URL_TEST ?? DEFAULT_TEST_DATABASE_URL;

const getAdminConnectionString = (connectionString: string): string => {
	const url = parseConnectionString(connectionString);
	url.pathname = "/postgres";
	return url.toString();
};

const ensureTestDatabaseExists = async (connectionString: string): Promise<void> => {
	const adminConnectionString = getAdminConnectionString(connectionString);
	const testUrl = parseConnectionString(connectionString);
	const databaseName = getDatabaseName(testUrl);

	const adminClient = createSqlClient(adminConnectionString);

	try {
		const rows = await adminClient.unsafe<{ exists: boolean }[]>(
			"SELECT EXISTS(SELECT 1 FROM pg_database WHERE datname = $1) AS exists",
			[databaseName],
		);
		if (rows[0]?.exists) {
			return;
		}

		try {
			await adminClient.unsafe(`CREATE DATABASE ${quoteIdentifier(databaseName)}`);
		} catch (error) {
			const code =
				typeof error === "object" && error !== null && "code" in error ? String(error.code) : null;
			if (code !== "42P04") {
				throw error;
			}
		}
	} finally {
		await adminClient.end({ timeout: 5 });
	}
};

const ensureTestDatabaseReady = async (connectionString: string): Promise<void> => {
	if (preparedDatabases.has(connectionString)) {
		return;
	}

	await ensureTestDatabaseExists(connectionString);

	const { client, db } = createDatabaseClient(connectionString);

	try {
		await client.unsafe("CREATE EXTENSION IF NOT EXISTS vector");
		await migrateDatabase(db, migrationsFolder);
		preparedDatabases.add(connectionString);
	} finally {
		await client.end({ timeout: 5 });
	}
};

const resetTestDatabase = async (client: SqlClient): Promise<void> => {
	const tables = await client.unsafe<{ tablename: string }[]>(
		`
			SELECT tablename
			FROM pg_tables
			WHERE schemaname = 'public'
				AND tablename <> '__drizzle_migrations'
		`,
	);

	if (tables.length === 0) {
		return;
	}

	const tableList = tables
		.map(({ tablename }) => `"public".${quoteIdentifier(tablename)}`)
		.join(", ");

	await client.unsafe(`TRUNCATE TABLE ${tableList} RESTART IDENTITY CASCADE`);
};

/**
 * Starts a test server backed by a dedicated local test database.
 */
export const startTestServer = async (_testName: string): Promise<TestServer> => {
	const connectionString = getTestConnectionString();
	assertSafeTestConnectionString(connectionString);
	await ensureTestDatabaseReady(connectionString);

	const { client, db } = createDatabaseClient(connectionString);

	try {
		await resetTestDatabase(client);

		return {
			close: async () => {
				await client.end({ timeout: 5 });
			},
			db,
		};
	} catch (error) {
		await client.end({ timeout: 5 });
		throw error;
	}
};

/**
 * Creates a test user with session for authenticated handler tests.
 */
export const createTestUser = async (
	db: TestDatabase,
	options?: {
		email?: string;
		name?: string;
		stripeCustomerId?: string | null;
	},
): Promise<{
	user: typeof user.$inferSelect;
	session: Session;
}> => {
	const email = options?.email ?? `test-${Date.now()}@example.com`;
	const name = options?.name ?? "Test User";
	const stripeCustomerId =
		options && "stripeCustomerId" in options ? options.stripeCustomerId : `cus_test_${Date.now()}`;
	const userId = crypto.randomUUID();

	const [fetchedUser] = await db
		.insert(user)
		.values({
			email,
			emailVerified: true,
			id: userId,
			name,
			stripeCustomerId,
		})
		.returning();

	if (!fetchedUser) {
		throw new Error("Failed to create test user");
	}

	return {
		session: {
			session: {
				createdAt: new Date(),
				expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
				id: crypto.randomUUID(),
				ipAddress: "127.0.0.1",
				token: crypto.randomUUID(),
				updatedAt: new Date(),
				userAgent: "test-agent",
				userId: fetchedUser.id,
			},
			user: {
				...fetchedUser,
				name: fetchedUser.name ?? "",
			},
		},
		user: fetchedUser,
	};
};

type TestSession = Session;

/**
 * Admin email address used in tests (matches ADMIN_EMAIL in preload.ts mock)
 */
export const ADMIN_EMAIL = "admin@test.com";

/**
 * Creates a test context for oRPC handlers
 * This allows calling handlers directly without HTTP overhead
 */
export const createTestContext = (options: { db: TestDatabase; session?: TestSession }) => ({
	db: options.db,
	session: options.session,
});

/**
 * Creates a mock session for authenticated handler tests.
 */
export const createMockSession = (mockUser: {
	email: string;
	id: string;
	name?: string | null;
	stripeCustomerId?: string | null;
	emailVerified?: boolean;
	image?: string | null;
}): Session => ({
	session: {
		createdAt: new Date(),
		expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
		id: crypto.randomUUID(),
		ipAddress: "127.0.0.1",
		token: crypto.randomUUID(),
		updatedAt: new Date(),
		userAgent: "test-agent",
		userId: mockUser.id,
	},
	user: {
		createdAt: new Date(),
		email: mockUser.email,
		emailVerified: mockUser.emailVerified ?? true,
		id: mockUser.id,
		image: mockUser.image ?? null,
		name: mockUser.name ?? "Test User",
		stripeCustomerId: mockUser.stripeCustomerId ?? `cus_test_${Date.now()}`,
		updatedAt: new Date(),
	},
});

const getRequiredRow = <T>(rows: T[], message: string): T => {
	const [row] = rows;
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
		examples?: string[];
	},
) => {
	const { template } = await import("@repo/database");

	const result = await db
		.insert(template)
		.values({
			authorId,
			category: options?.category ?? "Test Category",
			content: options?.content ?? "Test content",
			embedding: options?.embedding ?? Array.from({ length: 1024 }, () => Math.random()),
			examples: options?.examples ?? [],
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
		cost?: number | string;
		timestamp?: Date;
		timeToCompletionMs?: number;
		timeToFirstTokenMs?: number;
	},
) => {
	const { usageEvent } = await import("@repo/database");

	const result = await db
		.insert(usageEvent)
		.values({
			cost: options?.cost?.toString(),
			id: crypto.randomUUID(),
			inputTokens: options?.inputTokens ?? 100,
			model: "test-model",
			name: options?.name ?? "ai_scribe_generation",
			outputTokens: options?.outputTokens ?? 200,
			timestamp: options?.timestamp ?? new Date(),
			timeToCompletionMs: options?.timeToCompletionMs,
			timeToFirstTokenMs: options?.timeToFirstTokenMs,
			totalTokens: (options?.inputTokens ?? 100) + (options?.outputTokens ?? 200),
			userId,
		})
		.returning();

	return getRequiredRow(result, "Failed to create test usage event");
};

/**
 * Seed a minimal provider/model/default setup so resolver-based handlers can run.
 */
export const createTestAiDefaults = async (
	db: TestDatabase,
): Promise<{
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
			defaultEvaluationModel: modelRecordId,
			defaultFileImageModelId: modelRecordId,
			defaultSpeechToTextModelId: modelRecordId,
			defaultTextModelId: modelRecordId,
			id: "global",
			updatedAt: new Date(),
		})
		.onConflictDoUpdate({
			set: {
				defaultEvaluationModel: modelRecordId,
				defaultFileImageModelId: modelRecordId,
				defaultSpeechToTextModelId: modelRecordId,
				defaultTextModelId: modelRecordId,
				updatedAt: new Date(),
			},
			target: aiDefaults.id,
		});

	return { modelId, modelRecordId, providerId };
};
