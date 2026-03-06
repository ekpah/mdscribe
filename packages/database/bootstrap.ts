import { database } from "./client";
import { initSchemaSQL } from "./init-schema";
import { seedDatabase } from "./seed";

async function bootstrapDatabase(): Promise<void> {
	try {
		console.log("Applying development database schema...");
		await database.$client.unsafe(initSchemaSQL);
		console.log("Schema ready");

		await seedDatabase(database);
		console.log("Development seed complete");
	} finally {
		await database.$client.end({ timeout: 5 });
	}
}

bootstrapDatabase().catch((error) => {
	console.error("Database bootstrap failed:", error);
	process.exit(1);
});
