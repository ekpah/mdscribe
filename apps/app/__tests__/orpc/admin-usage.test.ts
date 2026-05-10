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

const formatBucket = (date: Date, timeZone: string, granularity: "day" | "hour") => {
	const parts = new Intl.DateTimeFormat("en-CA", {
		day: "2-digit",
		hour: "2-digit",
		hourCycle: "h23",
		hour12: false,
		month: "2-digit",
		timeZone,
		year: "numeric",
	})
		.formatToParts(date)
		.reduce<Record<string, string>>((current, part) => {
			current[part.type] = part.value;
			return current;
		}, {});
	const hour = granularity === "hour" ? parts.hour : "00";
	return `${parts.year}-${parts.month}-${parts.day}T${hour}:00:00`;
};

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

	test("returns hourly trend buckets for today with percentile metrics", async () => {
		const timestamp = new Date();
		timestamp.setMinutes(15, 0, 0);
		const currentBucketKey = formatBucket(timestamp, "UTC", "hour");

		await createTestUsageEvent(server.db, userId, {
			cost: "0.25",
			inputTokens: 100,
			outputTokens: 100,
			timestamp,
			timeToCompletionMs: 2000,
			timeToFirstTokenMs: 500,
		});

		const stats = await call(
			usageHandler.stats,
			{ filter: "today", timeZone: "UTC" },
			{ context },
		);
		const currentBucket = stats.trend.find((bucket) => bucket.bucket === currentBucketKey);

		expect(stats.trendGranularity).toBe("hour");
		expect(stats.timeZone).toBe("UTC");
		expect(currentBucket?.bucket.endsWith("Z")).toBe(false);
		expect(currentBucket?.events).toBe(1);
		expect(currentBucket?.tokens).toBe(200);
		expect(currentBucket?.cost).toBe(0.25);
		expect(currentBucket?.timeToFirstTokenMs).toEqual({ p50: 500, p90: 500, p95: 500 });
		expect(currentBucket?.timeToCompletionMs).toEqual({ p50: 2000, p90: 2000, p95: 2000 });
		expect(currentBucket?.tokensPerSecond).toEqual({ p50: 50, p90: 50, p95: 50 });
	});

	test("returns daily trend buckets for week filters", async () => {
		const timestamp = new Date();
		timestamp.setHours(11, 30, 0, 0);
		const currentBucketKey = formatBucket(timestamp, "UTC", "day");

		await createTestUsageEvent(server.db, userId, {
			cost: "0.10",
			inputTokens: 100,
			outputTokens: 50,
			timestamp,
		});
		await createTestUsageEvent(server.db, userId, {
			cost: "0.20",
			inputTokens: 200,
			outputTokens: 100,
			timestamp,
		});

		const stats = await call(
			usageHandler.stats,
			{ filter: "week", timeZone: "UTC" },
			{ context },
		);
		const currentBucket = stats.trend.find((bucket) => bucket.bucket === currentBucketKey);

		expect(stats.trendGranularity).toBe("day");
		expect(currentBucket?.events).toBe(2);
		expect(currentBucket?.tokens).toBe(450);
		expect(currentBucket?.cost).toBeCloseTo(0.3);
	});

	test("buckets trend data in the requested user timezone", async () => {
		const timestamp = new Date();
		timestamp.setMinutes(17, 0, 0);
		const berlinBucketKey = formatBucket(timestamp, "Europe/Berlin", "hour");

		await createTestUsageEvent(server.db, userId, {
			inputTokens: 1000,
			outputTokens: 561,
			timestamp,
		});

		const stats = await call(
			usageHandler.stats,
			{ filter: "today", timeZone: "Europe/Berlin" },
			{ context },
		);
		const currentBucket = stats.trend.find((bucket) => bucket.bucket === berlinBucketKey);

		expect(stats.timeZone).toBe("Europe/Berlin");
		expect(currentBucket?.events).toBe(1);
		expect(currentBucket?.tokens).toBe(1561);
	});
});
