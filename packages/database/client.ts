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

function getTarballPath(): string {
	return "./.pglite-data/dev-db.tar.gz";
}

// Global singleton for PGlite to persist across HMR in development
// Store the client, drizzle instance, AND the initialization promise to prevent race conditions
const globalForPGlite = globalThis as unknown as {
	pgliteClient: PGlite | undefined;
	pgliteDb: ReturnType<typeof drizzlePGlite<typeof schema>> | undefined;
	pgliteInitPromise:
		| Promise<ReturnType<typeof drizzlePGlite<typeof schema>>>
		| undefined;
	shutdownHandlersRegistered: boolean | undefined;
};

/**
 * Load existing tarball if it exists
 * Returns the tarball data as Blob, or null if not found
 */
async function loadTarballIfExists(): Promise<Blob | null> {
	const tarballPath = getTarballPath();
	const file = Bun.file(tarballPath);
	if (!(await file.exists())) {
		console.log("No existing PGlite tarball found, will create fresh database");
		return null;
	}

	try {
		console.log(`Loading PGlite database from ${tarballPath}`);
		// Bun.file() returns a BunFile which extends Blob
		return file;
	} catch (error) {
		console.error("Failed to load PGlite tarball:", error);
		return null;
	}
}

/**
 * Save the database state to a tarball
 */
async function saveTarball(client: PGlite): Promise<void> {
	try {
		const tarballPath = getTarballPath();

		console.log("Dumping PGlite database to tarball...");
		const blob = await client.dumpDataDir();

		// Bun.write() accepts Blob directly
		await Bun.write(tarballPath, blob);
		console.log(`PGlite database saved to ${tarballPath}`);
	} catch (error) {
		console.error("Failed to save PGlite tarball:", error);
	}
}

/**
 * Register process signal handlers to save database on shutdown
 * Only registers once, even across HMR reloads
 */
function registerShutdownHandlers(client: PGlite): void {
	if (globalForPGlite.shutdownHandlersRegistered) {
		return;
	}

	let isShuttingDown = false;

	const handleShutdown = async (signal: string) => {
		// Prevent multiple shutdown attempts
		if (isShuttingDown) return;
		isShuttingDown = true;

		console.log(`\nReceived ${signal}, saving PGlite database...`);
		try {
			await saveTarball(client);
			await client.close();
			console.log("PGlite shutdown complete");
		} catch (error) {
			console.error("Error during shutdown:", error);
		}
		process.exitCode = 0;
		process.exit(0);
	};

	// Register handlers
	process.on("SIGINT", () => {
		void handleShutdown("SIGINT");
	});
	process.on("SIGTERM", () => {
		void handleShutdown("SIGTERM");
	});

	globalForPGlite.shutdownHandlersRegistered = true;
	console.log("PGlite shutdown handlers registered");
}

async function createPGliteDatabase() {
	// Try to load existing database from tarball
	const existingTarball = await loadTarballIfExists();
	const loadedFromTarball = existingTarball !== null;

	// Use PGlite in-memory for local development with vector extension
	console.log(
		"Using PGlite (in-memory with persistence) for local development",
	);
	const client = new PGlite({
		extensions: { vector },
		...(existingTarball && { loadDataDir: existingTarball }),
	});

	// Only initialize schema if we didn't load from tarball
	if (!loadedFromTarball) {
		console.log("Initializing PGlite schema...");
		await client.exec(initSchemaSQL);
		console.log("PGlite schema initialized successfully");
	} else {
		console.log(
			"Loaded existing database from tarball, skipping schema initialization",
		);
	}

	const db = drizzlePGlite({ client, schema });

	// Cache both client and db globally
	globalForPGlite.pgliteClient = client;
	globalForPGlite.pgliteDb = db;

	// Register shutdown handlers to save on exit
	registerShutdownHandlers(client);

	// Save once on startup to persist initial state
	try {
		await saveTarball(client);
	} catch (error) {
		console.error("Startup save failed:", error);
	}

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
