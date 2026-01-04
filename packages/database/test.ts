import { PGlite } from "@electric-sql/pglite";
import { vector } from "@electric-sql/pglite/vector";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";

import { initSchemaSQL } from "./init-schema";
import * as schema from "./schema";
import { user } from "./schema";

export type TestDatabase = ReturnType<typeof drizzle<typeof schema>>;

export interface TestServer {
	db: TestDatabase;
	close: () => Promise<void>;
}

/**
 * Starts a test server with an in-memory PGlite database
 */
export async function startTestServer(_testName: string): Promise<TestServer> {
	// Use in-memory PGlite for tests with vector extension (no path = in-memory)
	const client = new PGlite({
		extensions: { vector },
	});

	// Create the Drizzle instance
	const db = drizzle({ client, schema });

	// Initialize schema
	await client.exec(initSchemaSQL);

	return {
		db,
		close: async () => {
			await client.close();
		},
	};
}

/**
 * Creates a test user with session for authenticated handler tests
 */
export async function createTestUser(
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
}> {
	const email = options?.email ?? `test-${Date.now()}@example.com`;
	const name = options?.name ?? "Test User";
	const stripeCustomerId = options?.stripeCustomerId ?? `cus_test_${Date.now()}`;
	const userId = crypto.randomUUID();

	// Create user
	await db.insert(user).values({
		id: userId,
		email,
		name,
		emailVerified: true,
		stripeCustomerId,
	});

	// Fetch the user we just created
	const [fetchedUser] = await db.select().from(user).where(eq(user.id, userId)).limit(1);

	if (!fetchedUser) {
		throw new Error("Failed to create test user");
	}

	return {
		user: fetchedUser,
		session: {
			user: fetchedUser,
		},
	};
}
