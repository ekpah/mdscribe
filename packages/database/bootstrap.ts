import { database } from "./client";
import { initSchemaSQL } from "./init-schema";
import { seedDatabase } from "./seed";

const bootstrapDatabase = async (): Promise<void> => {
	console.log("Applying development database schema...");
	await database.$client.unsafe(initSchemaSQL);
	console.log("Schema ready");

	await seedDatabase(database);
	console.log("Development seed complete");
};

try {
	await bootstrapDatabase();
} catch (error) {
	console.error("Database bootstrap failed:", error);
	process.exit(1);
}
