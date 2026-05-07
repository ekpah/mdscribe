import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { call } from "@orpc/server";

import {
	ADMIN_EMAIL,
	createTestContext,
	createTestUsageEvent,
	createTestUser,
	startTestServer,
} from "@/__tests__/setup";
import type { TestServer } from "@/__tests__/setup";
import { usageHandler } from "@/orpc/admin/usage";

describe("Admin usage stats", () => {
	let server: TestServer;
	let context: ReturnType<typeof createTestContext>;
	let userId: string;

	beforeEach(async () => {
		server = await startTestServer("admin-usage");
		const { session, user } = await createTestUser(server.db, { email: ADMIN_EMAIL });
		context = createTestContext({ db: server.db, session });
		userId = user.id;
	});

	afterEach(async () => {
		await server?.close();
	});

	test("calculates request duration aggregates and tokens per second", async () => {
		await createTestUsageEvent(server.db, userId, {
			inputTokens: 100,
			outputTokens: 100,
			timeToCompletionMs: 2000,
			timeToFirstTokenMs: 500,
		});
		await createTestUsageEvent(server.db, userId, {
			inputTokens: 50,
			outputTokens: 50,
			timeToCompletionMs: 1000,
			timeToFirstTokenMs: 1500,
		});

		const stats = await call(usageHandler.stats, { filter: "all" }, { context });

		expect(stats.averageTimeToCompletionMs).toBe(1500);
		expect(stats.averageTimeToFirstTokenMs).toBe(1000);
		expect(stats.tokensPerSecond).toBe(50);
	});
});
