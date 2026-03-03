import { defineConfig } from "drizzle-kit";

export default defineConfig({
	dbCredentials: {
		url: process.env.POSTGRES_DATABASE_URL!,
	},
	dialect: "postgresql",
	out: "./drizzle",
	schema: "./schema.ts",
	// We're using an existing database schema, so we don't want to auto-migrate
	strict: true,
	verbose: true,
});
