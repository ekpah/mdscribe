import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { initSchemaSQL } from "./init-schema";
import * as schema from "./schema";
import { user } from "./schema";

export type TestDatabase = ReturnType<typeof drizzle<typeof schema>>;

export interface TestServer {
	db: TestDatabase;
	close: () => Promise<void>;
}

const getTestConnectionString = (): string => {
	return (
		process.env.POSTGRES_DATABASE_URL_TEST ??
		process.env.POSTGRES_DATABASE_URL ??
		"postgres://postgres:postgres@127.0.0.1:5432/mdscribe"
	);
};

const createTestSchemaName = (testName: string): string => {
	const normalized = testName
		.toLowerCase()
		.replaceAll(/[^a-z0-9]+/g, "_")
		.replaceAll(/^_+|_+$/g, "")
		.slice(0, 40);
	const suffix = crypto.randomUUID().replaceAll("-", "").slice(0, 12);
	return `test_${normalized || "case"}_${suffix}`;
};

/**
 * Starts a test server with an isolated Postgres schema.
 */
export const startTestServer = async (
	testName: string,
): Promise<TestServer> => {
	const connectionString = getTestConnectionString();
	const schemaName = createTestSchemaName(testName);
	const client = postgres(connectionString, {
		max: 1,
		prepare: false,
	});

	await client.unsafe(`CREATE SCHEMA "${schemaName}"`);
	await client.unsafe(`SET search_path TO "${schemaName}", public`);
	await client.unsafe(initSchemaSQL);

	const db = drizzle(client, { schema });

	return {
		close: async () => {
			try {
				await client.unsafe(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
			} finally {
				await client.end({ timeout: 5 });
			}
		},
		db,
	};
};

/**
 * Creates a test user with session for authenticated handler tests
 */
export const createTestUser = async (
	db: TestDatabase,
	options?: {
		email?: string;
		name?: string;
		stripeCustomerId?: string;
	},
): Promise<{
	user: typeof schema.user.$inferSelect;
	session: {
		user: typeof schema.user.$inferSelect;
	};
}> => {
	const email = options?.email ?? `test-${Date.now()}@example.com`;
	const name = options?.name ?? "Test User";
	const stripeCustomerId = options?.stripeCustomerId ?? `cus_test_${Date.now()}`;
	const userId = crypto.randomUUID();

	await db.insert(user).values({
		email,
		emailVerified: true,
		id: userId,
		name,
		stripeCustomerId,
	});

	const [fetchedUser] = await db
		.select()
		.from(user)
		.where(eq(user.id, userId))
		.limit(1);

	if (!fetchedUser) {
		throw new Error("Failed to create test user");
	}

	return {
		session: {
			user: fetchedUser,
		},
		user: fetchedUser,
	};
};
