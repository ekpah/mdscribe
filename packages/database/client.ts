import "server-only";

import { PGlite } from "@electric-sql/pglite";
import { vector } from "@electric-sql/pglite/vector";
import { Pool } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-serverless";
import { drizzle as drizzlePGlite } from "drizzle-orm/pglite";

import { initSchemaSQL } from "./init-schema";
import * as schema from "./schema";

// Environment detection
const isLocalDev = process.env.NODE_ENV !== "production" && !process.env.VERCEL;

// Global singleton for PGlite to persist across HMR in development
// Store the client, drizzle instance, AND the initialization promise to prevent race conditions
const globalForPGlite = globalThis as unknown as {
	pgliteClient: PGlite | undefined;
	pgliteDb: ReturnType<typeof drizzlePGlite<typeof schema>> | undefined;
	pgliteInitPromise: Promise<ReturnType<typeof drizzlePGlite<typeof schema>>> | undefined;
};

async function createPGliteDatabase() {
	// Use PGlite in-memory for local development with vector extension
	// In-memory mode avoids file lock conflicts when Next.js spawns multiple worker processes
	console.log("Using PGlite (in-memory) for local development");
	const client = new PGlite({
		extensions: { vector },
	});

	// Initialize schema before returning
	console.log("Initializing PGlite schema...");
	await client.exec(initSchemaSQL);
	console.log("PGlite schema initialized successfully");

	const db = drizzlePGlite({ client, schema });

	// Cache both client and db globally
	globalForPGlite.pgliteClient = client;
	globalForPGlite.pgliteDb = db;

	return db;
}

async function createDatabase() {
	if (isLocalDev) {
		// Return cached instance if already initialized
		if (globalForPGlite.pgliteDb) {
			return globalForPGlite.pgliteDb;
		}

		// If initialization is in progress, wait for it
		if (globalForPGlite.pgliteInitPromise) {
			return globalForPGlite.pgliteInitPromise;
		}

		// Start initialization and store the promise to prevent race conditions
		globalForPGlite.pgliteInitPromise = createPGliteDatabase();
		return globalForPGlite.pgliteInitPromise;
	}

	// Use Neon serverless for production
	const pool = new Pool({
		connectionString: process.env.POSTGRES_DATABASE_URL,
	});
	return drizzleNeon({ client: pool, schema });
}

// Use top-level await to ensure database is initialized before export
const database = await createDatabase();

export { database };

// Export the database type for middleware typing
export type Database = typeof database;
