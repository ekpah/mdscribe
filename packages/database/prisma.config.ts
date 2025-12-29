import "dotenv/config";
import type { PrismaConfig } from "prisma";
import { defineConfig, env } from "prisma/config";

export default {
	schema: "prisma/schema.prisma",
	migrations: {
		path: "prisma/migrations",
	},
	datasource: {
		url: env("POSTGRES_DATABASE_URL"),
	},
} satisfies PrismaConfig;
