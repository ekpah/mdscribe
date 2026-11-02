import { expect, test } from "bun:test";

import { createSqlClient } from "@repo/database/connect";

import { startTestServer } from "../setup";

test("SQL clients preserve Date inference in overloaded functions outside UTC", async () => {
	await startTestServer("database-client");
	// Drizzle replaces timestamp serializers on its client; exercise the raw SQL client.
	const client = createSqlClient(
		process.env.POSTGRES_DATABASE_URL_TEST ??
			"postgres://postgres:postgres@127.0.0.1:5432/mdscribe_test",
	);
	try {
		await client.begin(async (sql) => {
			await sql`set local time zone 'Europe/Berlin'`;
			const [row] = await sql`
				select date_trunc('day', ${new Date("2026-07-01T12:34:56Z")}) as value
			`;
			expect(row.value.toISOString()).toBe("2026-06-30T22:00:00.000Z");
		});
	} finally {
		await client.end({ timeout: 5 });
	}
});
