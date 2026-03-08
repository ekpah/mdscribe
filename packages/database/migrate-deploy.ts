import { migrate } from "drizzle-orm/postgres-js/migrator";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

const getConnectionString = (): string => {
	const connectionString = process.env.POSTGRES_DATABASE_URL;

	if (!connectionString) {
		throw new Error("POSTGRES_DATABASE_URL is required");
	}

	return connectionString;
};

const LOCK_NAMESPACE = 26451;
const LOCK_OPERATION = 1;

async function runMigrations(): Promise<void> {
	const client = postgres(getConnectionString(), {
		max: 1,
	});
	const db = drizzle(client);
	const migrationsFolder = `${import.meta.dir}/drizzle`;
	let hasLock = false;

	try {
		console.log(`Applying database migrations from ${migrationsFolder}...`);
		await client`select pg_advisory_lock(${LOCK_NAMESPACE}, ${LOCK_OPERATION})`;
		hasLock = true;

		await migrate(db, {
			migrationsFolder,
		});
		console.log("Database migrations complete");
	} finally {
		if (hasLock) {
			await client`select pg_advisory_unlock(${LOCK_NAMESPACE}, ${LOCK_OPERATION})`;
		}

		await client.end({ timeout: 5 });
	}
}

runMigrations().catch((error) => {
	console.error("Database migration failed:", error);
	process.exit(1);
});
