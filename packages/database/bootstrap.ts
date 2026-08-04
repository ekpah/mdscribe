import { database } from "./client";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { seedDatabase } from "./seed";

const hasTable = async (tableName: string): Promise<boolean> => {
	const rows = await database.$client.unsafe<{ exists: boolean }[]>(
		"SELECT to_regclass($1) IS NOT NULL AS exists",
		[tableName],
	);
	return rows[0]?.exists ?? false;
};

const bootstrapDatabase = async (): Promise<void> => {
	try {
		console.log("Ensuring pgvector extension...");
		await database.$client.unsafe("CREATE EXTENSION IF NOT EXISTS vector");

		const hasMigrationsTable = await hasTable("public.__drizzle_migrations");
		const hasUserTable = await hasTable('public."User"');

		if (hasMigrationsTable || !hasUserTable) {
			console.log("Applying database migrations...");
			await migrate(database, { migrationsFolder: "./drizzle" });
			console.log("Migrations complete");
		} else {
			console.log(
				"Existing schema detected without drizzle migration history, skipping migrations.",
			);
		}

		await seedDatabase(database);
		console.log("Database bootstrap complete");
	} finally {
		await database.$client.end({ timeout: 5 });
	}
};

try {
	await bootstrapDatabase();
} catch (error) {
	console.error("Database bootstrap failed:", error);
	process.exit(1);
}
