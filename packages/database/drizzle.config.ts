import { defineConfig } from "drizzle-kit";

export default defineConfig({
	schema: "./schema.ts",
	out: "./drizzle",
	dialect: "postgresql",
	dbCredentials: {
		url: process.env.POSTGRES_DATABASE_URL!,
	},
	// We're using an existing database schema, so we don't want to auto-migrate
	strict: true,
	verbose: true,
});
