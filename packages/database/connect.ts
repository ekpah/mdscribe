import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

import * as schema from "./schema";

export type DatabaseWithSchema = ReturnType<typeof drizzle<typeof schema>>;
export type SqlClient = ReturnType<typeof postgres>;

export const createSqlClient = (
	connectionString: string,
	options?: {
		max?: number;
		prepare?: boolean;
	},
): SqlClient =>
	postgres(connectionString, {
		max: options?.max ?? 1,
		prepare: options?.prepare ?? false,
	});

export const createDatabaseClient = (
	connectionString: string,
	options?: {
		max?: number;
		prepare?: boolean;
	},
): {
	client: SqlClient;
	db: DatabaseWithSchema;
} => {
	const client = createSqlClient(connectionString, options);
	const db = drizzle(client, { schema });

	return { client, db };
};

export const migrateDatabase = async (
	db: DatabaseWithSchema,
	migrationsFolder: string,
): Promise<void> => {
	await migrate(db, { migrationsFolder });
};
