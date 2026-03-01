import { database } from "./runtime-client";
import { initSchemaSQL } from "./init-schema";
import { seedDatabase } from "./seed";

async function bootstrapDatabase(): Promise<void> {
	console.log("Applying development database schema...");
	await database.$client.unsafe(initSchemaSQL);
	console.log("Schema ready");

	await seedDatabase(database);
	console.log("Development seed complete");
}

bootstrapDatabase().catch((error) => {
	console.error("Database bootstrap failed:", error);
	process.exit(1);
});
