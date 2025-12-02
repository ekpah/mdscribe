import type { PrismaConfig } from "prisma";
import { env } from "@repo/env";

export default {
	schema: "prisma/schema.prisma",
	migrations: {
		path: "prisma/migrations",
	},
	datasource: {
		url: env.POSTGRES_DATABASE_URL as string,
	},
} satisfies PrismaConfig;
