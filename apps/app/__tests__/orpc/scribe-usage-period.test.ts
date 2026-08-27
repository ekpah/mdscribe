import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { aiProvider, usageEvent, userAiProvider } from "@repo/database";

import { createTestSubscription, createTestUser, startTestServer } from "@/__tests__/setup";
import type { TestServer } from "@/__tests__/setup";
import { getUsage } from "@/orpc/scribe/_lib/get-usage";

describe("Scribe subscription usage periods", () => {
	let server: TestServer;

	beforeEach(async () => {
		server = await startTestServer("scribe-usage-period");
	});

	afterEach(async () => {
		await server?.close();
	});

	test("counts only usage since the subscriber's billing-period start", async () => {
		const { session, user } = await createTestUser(server.db);
		await createTestSubscription(server.db, user.id, {
			periodEnd: new Date("2026-08-15T09:30:00.000Z"),
			periodStart: new Date("2026-07-15T09:30:00.000Z"),
		});
		await server.db.insert(usageEvent).values([
			{
				cost: "7.000000",
				name: "ai_scribe_generation",
				timestamp: new Date("2026-07-10T12:00:00.000Z"),
				userId: user.id,
			},
			{
				cost: "2.000000",
				name: "ai_scribe_generation",
				timestamp: new Date("2026-07-20T12:00:00.000Z"),
				userId: user.id,
			},
		]);

		const result = await getUsage(session, server.db, new Date("2026-07-31T12:00:00.000Z"));

		expect(result.usage.count).toBe(1);
		expect(result.usage.hasActiveByokConnection).toBe(false);
		expect(result.usage.monthlyUsagePercentage).toBe(25);
		expect(result.usage.periodStartsAt).toBe("2026-07-15T09:30:00.000Z");
		expect(result.usage.periodType).toBe("subscription");
		expect(result.usage.resetsAt).toBe("2026-08-15T09:30:00.000Z");
	});

	test("reports an active user API-key connection as BYOK usage", async () => {
		const { session, user } = await createTestUser(server.db);
		const providerId = crypto.randomUUID();
		await server.db.insert(aiProvider).values({
			byokEnabled: true,
			id: providerId,
			name: "OpenRouter",
			protocol: "openrouter",
		});
		await server.db.insert(userAiProvider).values({
			apiKey: "encrypted-test-key",
			enabled: true,
			name: "Eigener Schlüssel",
			providerId,
			userId: user.id,
			validatedAt: new Date(),
		});

		const result = await getUsage(session, server.db);

		expect(result.usage.hasActiveByokConnection).toBe(true);
	});
});
