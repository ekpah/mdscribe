import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

if (typeof window !== "undefined") {
	throw new Error("Database client can only run on the server");
}

const connectionString = process.env.POSTGRES_DATABASE_URL;

if (!connectionString) {
	throw new Error("POSTGRES_DATABASE_URL is required");
}
const postgresUrl = connectionString;

const globalForDatabase = globalThis as unknown as {
	database: ReturnType<typeof drizzle<typeof schema>> | undefined;
	pgClient: ReturnType<typeof postgres> | undefined;
	shutdownHandlersRegistered: boolean | undefined;
};

function registerShutdownHandlers(client: ReturnType<typeof postgres>): void {
	if (globalForDatabase.shutdownHandlersRegistered) {
		return;
	}

	let isShuttingDown = false;

	const handleShutdown = async (signal: string) => {
		if (isShuttingDown) return;
		isShuttingDown = true;

		console.log(`\nReceived ${signal}, closing Postgres client...`);
		try {
			await client.end({ timeout: 5 });
			console.log("Postgres shutdown complete");
		} catch (error) {
			console.error("Error during Postgres shutdown:", error);
		}
		process.exitCode = 0;
		process.exit(0);
	};

	process.on("SIGINT", () => {
		void handleShutdown("SIGINT");
	});
	process.on("SIGTERM", () => {
		void handleShutdown("SIGTERM");
	});

	globalForDatabase.shutdownHandlersRegistered = true;
}

function createDatabase() {
	if (globalForDatabase.database) {
		return globalForDatabase.database;
	}

	const client =
		globalForDatabase.pgClient ??
		postgres(postgresUrl, {
			max: process.env.NODE_ENV === "production" ? 20 : 5,
			prepare: false,
		});

	globalForDatabase.pgClient = client;
	registerShutdownHandlers(client);

	const database = drizzle(client, { schema });
	globalForDatabase.database = database;

	return database;
}

const database = createDatabase();

export { database };
export type Database = typeof database;
