import "server-only";

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { PGlite } from "@electric-sql/pglite";
import { vector } from "@electric-sql/pglite/vector";
import { Pool } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-serverless";
import { drizzle as drizzlePGlite } from "drizzle-orm/pglite";

import { initSchemaSQL } from "./init-schema";
import * as schema from "./schema";

// Environment detection
const isLocalDev = process.env.NODE_ENV !== "production" && !process.env.VERCEL;

// Persistence paths for local development
const __dirname = dirname(fileURLToPath(import.meta.url));
const PGLITE_DATA_DIR = join(__dirname, ".pglite-data");
const PGLITE_TARBALL_PATH = join(PGLITE_DATA_DIR, "dev-db.tar.gz");

// Global singleton for PGlite to persist across HMR in development
// Store the client, drizzle instance, AND the initialization promise to prevent race conditions
const globalForPGlite = globalThis as unknown as {
	pgliteClient: PGlite | undefined;
	pgliteDb: ReturnType<typeof drizzlePGlite<typeof schema>> | undefined;
	pgliteInitPromise: Promise<ReturnType<typeof drizzlePGlite<typeof schema>>> | undefined;
	shutdownHandlersRegistered: boolean | undefined;
};

/**
 * Load existing tarball if it exists
 * Returns the tarball data as Blob, or null if not found
 */
function loadTarballIfExists(): Blob | null {
	if (!existsSync(PGLITE_TARBALL_PATH)) {
		console.log("No existing PGlite tarball found, will create fresh database");
		return null;
	}

	try {
		console.log(`Loading PGlite database from ${PGLITE_TARBALL_PATH}`);
		const buffer = readFileSync(PGLITE_TARBALL_PATH);
		// PGlite expects a Blob for loadDataDir
		return new Blob([buffer]);
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
		// Ensure directory exists
		if (!existsSync(PGLITE_DATA_DIR)) {
			mkdirSync(PGLITE_DATA_DIR, { recursive: true });
		}

		console.log("Dumping PGlite database to tarball...");
		const blob = await client.dumpDataDir();

		// Convert Blob to Buffer for Node.js file write
		const arrayBuffer = await blob.arrayBuffer();
		const buffer = Buffer.from(arrayBuffer);

		writeFileSync(PGLITE_TARBALL_PATH, buffer);
		console.log(`PGlite database saved to ${PGLITE_TARBALL_PATH}`);
	} catch (error) {
		console.error("Failed to save PGlite tarball:", error);
	}
}

// Auto-save interval in milliseconds (30 seconds)
const AUTO_SAVE_INTERVAL = 30_000;
// Initial save delay (5 seconds after startup)
const INITIAL_SAVE_DELAY = 5_000;

/**
 * Start periodic auto-save of the database
 */
function startAutoSave(client: PGlite): void {
	// Initial save after short delay
	const initialTimeout = setTimeout(async () => {
		try {
			await saveTarball(client);
		} catch (error) {
			console.error("Initial save failed:", error);
		}
	}, INITIAL_SAVE_DELAY);
	initialTimeout.unref();

	// Periodic saves
	const intervalId = setInterval(async () => {
		try {
			await saveTarball(client);
		} catch (error) {
			console.error("Auto-save failed:", error);
		}
	}, AUTO_SAVE_INTERVAL);
	intervalId.unref();
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
		process.exit(0);
	};

	// Register handlers
	process.on("SIGINT", () => {
		handleShutdown("SIGINT");
	});
	process.on("SIGTERM", () => {
		handleShutdown("SIGTERM");
	});

	// Start periodic auto-save as a fallback
	startAutoSave(client);

	globalForPGlite.shutdownHandlersRegistered = true;
	console.log("PGlite shutdown handlers registered (with auto-save every 30s)");
}

async function createPGliteDatabase() {
	// Try to load existing database from tarball
	const existingTarball = loadTarballIfExists();
	const loadedFromTarball = existingTarball !== null;

	// Use PGlite in-memory for local development with vector extension
	console.log("Using PGlite (in-memory with persistence) for local development");
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
		console.log("Loaded existing database from tarball, skipping schema initialization");
	}

	const db = drizzlePGlite({ client, schema });

	// Cache both client and db globally
	globalForPGlite.pgliteClient = client;
	globalForPGlite.pgliteDb = db;

	// Register shutdown handlers to save on exit
	registerShutdownHandlers(client);

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
