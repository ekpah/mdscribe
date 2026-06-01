import { defineConfig } from "drizzle-kit";

const databaseUrl = process.env.POSTGRES_DATABASE_URL;
if (!databaseUrl) {
	throw new Error("POSTGRES_DATABASE_URL is required");
}

export default defineConfig({
	dbCredentials: {
		url: databaseUrl,
	},
	dialect: "postgresql",
	out: "./drizzle",
	schema: "./schema.ts",
	// We're using an existing database schema, so we don't want to auto-migrate
	strict: true,
	verbose: true,
});
