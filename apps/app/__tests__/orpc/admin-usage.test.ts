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
	const dateParts: Record<string, string> = {};
	for (const part of new Intl.DateTimeFormat("en-CA", {
		day: "2-digit",
		hour: "2-digit",
		hour12: false,
		hourCycle: "h23",
		month: "2-digit",
		timeZone,
		year: "numeric",
	}).formatToParts(date)) {
		dateParts[part.type] = part.value;
	}
	const hour = granularity === "hour" ? dateParts.hour : "00";
	return `${dateParts.year}-${dateParts.month}-${dateParts.day}T${hour}:00:00`;
};

const formatMonthBucket = (year: number, month: number) =>
	`${year}-${String(month).padStart(2, "0")}-01T00:00:00`;

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
			timeToCompletionMs: 2000,
			timeToFirstTokenMs: 500,
			timestamp,
		});

		const stats = await call(usageHandler.stats, { filter: "today", timeZone: "UTC" }, { context });
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

	test("includes reasoning tokens in tokens per second", async () => {
		// total reflects input + output + reasoning (reasoning reported separately),
		// so generated tokens = total - input = output + reasoning = 200.
		await createTestUsageEvent(server.db, userId, {
			inputTokens: 100,
			outputTokens: 100,
			reasoningTokens: 100,
			timeToCompletionMs: 2000,
			totalTokens: 300,
		});

		const stats = await call(usageHandler.stats, { filter: "all" }, { context });

		// Without reasoning this would be 100 tokens / 2s = 50.
		expect(stats.tokensPerSecond).toBe(100);
	});

	test("inverts tokens-per-second percentiles so the slow tail surfaces as p90/p95", async () => {
		const timestamp = new Date();
		timestamp.setHours(11, 30, 0, 0);
		const currentBucketKey = formatBucket(timestamp, "UTC", "day");

		// 1000 tok/s (fast), 100 tok/s (slow). Lower is worse, so p90/p95 should
		// trend toward the slow value while p50 stays the median.
		await createTestUsageEvent(server.db, userId, {
			inputTokens: 0,
			outputTokens: 2000,
			timeToCompletionMs: 2000,
			timestamp,
			totalTokens: 2000,
		});
		await createTestUsageEvent(server.db, userId, {
			inputTokens: 0,
			outputTokens: 200,
			timeToCompletionMs: 2000,
			timestamp,
			totalTokens: 200,
		});

		const stats = await call(usageHandler.stats, { filter: "week", timeZone: "UTC" }, { context });
		const currentBucket = stats.trend.find((bucket) => bucket.bucket === currentBucketKey);
		const perSecond = currentBucket?.tokensPerSecond;

		expect(perSecond?.p90).not.toBeNull();
		expect(perSecond?.p95).not.toBeNull();
		expect(perSecond?.p90).toBeLessThanOrEqual(perSecond?.p50 ?? 0);
		expect(perSecond?.p95).toBeLessThanOrEqual(perSecond?.p90 ?? 0);
	});

	test("returns cost-per-request percentiles in trend buckets", async () => {
		const timestamp = new Date();
		timestamp.setHours(11, 30, 0, 0);
		const currentBucketKey = formatBucket(timestamp, "UTC", "day");

		for (const cost of ["0.10", "0.20", "0.30"]) {
			await createTestUsageEvent(server.db, userId, { cost, timestamp });
		}

		const stats = await call(usageHandler.stats, { filter: "week", timeZone: "UTC" }, { context });
		const currentBucket = stats.trend.find((bucket) => bucket.bucket === currentBucketKey);

		expect(currentBucket?.costPerRequest.p50).toBeCloseTo(0.2);
		expect(currentBucket?.costPerRequest.p90).toBeCloseTo(0.28);
		expect(currentBucket?.costPerRequest.p95).toBeCloseTo(0.29);
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

		const stats = await call(usageHandler.stats, { filter: "week", timeZone: "UTC" }, { context });
		const currentBucket = stats.trend.find((bucket) => bucket.bucket === currentBucketKey);

		expect(stats.trendGranularity).toBe("day");
		expect(currentBucket?.events).toBe(2);
		expect(currentBucket?.tokens).toBe(450);
		expect(currentBucket?.cost).toBeCloseTo(0.3);
	});

	test("counts an agent trace as a single event", async () => {
		const timestamp = new Date();
		timestamp.setHours(11, 30, 0, 0);
		const currentBucketKey = formatBucket(timestamp, "UTC", "day");
		const traceId = crypto.randomUUID();

		// Agent chat event plus two generateSection events share one trace.
		await createTestUsageEvent(server.db, userId, {
			name: "ai_scribe_agent",
			timestamp,
			traceId,
		});
		await createTestUsageEvent(server.db, userId, { timestamp, traceId });
		await createTestUsageEvent(server.db, userId, { timestamp, traceId });
		// A standalone generation without a trace still counts on its own.
		await createTestUsageEvent(server.db, userId, { timestamp });

		const stats = await call(usageHandler.stats, { filter: "week", timeZone: "UTC" }, { context });
		const currentBucket = stats.trend.find((bucket) => bucket.bucket === currentBucketKey);

		expect(stats.totalEvents).toBe(2);
		expect(currentBucket?.events).toBe(2);
	});

	test("returns all-time monthly active user buckets", async () => {
		const { user: secondUser } = await createTestUser(server.db, {
			email: "monthly-active-user@test.com",
		});

		await createTestUsageEvent(server.db, userId, {
			timestamp: new Date("2020-01-15T12:00:00.000Z"),
		});
		await createTestUsageEvent(server.db, userId, {
			timestamp: new Date("2020-03-04T12:00:00.000Z"),
		});
		await createTestUsageEvent(server.db, secondUser.id, {
			timestamp: new Date("2020-03-05T12:00:00.000Z"),
		});
		await createTestUsageEvent(server.db, secondUser.id, {
			timestamp: new Date("2020-03-06T12:00:00.000Z"),
		});

		const stats = await call(usageHandler.monthlyActiveUsers, { timeZone: "UTC" }, { context });
		const januaryBucket = stats.trend.find(
			(bucket) => bucket.bucket === formatMonthBucket(2020, 1),
		);
		const februaryBucket = stats.trend.find(
			(bucket) => bucket.bucket === formatMonthBucket(2020, 2),
		);
		const marchBucket = stats.trend.find((bucket) => bucket.bucket === formatMonthBucket(2020, 3));

		expect(stats.timeZone).toBe("UTC");
		expect(januaryBucket?.activeUsers).toBe(1);
		expect(februaryBucket?.activeUsers).toBe(0);
		expect(marchBucket?.activeUsers).toBe(2);
	});

	test("returns weekly AI request buckets alongside monthly active users", async () => {
		await createTestUsageEvent(server.db, userId, {
			timestamp: new Date("2020-01-15T12:00:00.000Z"),
		});
		await createTestUsageEvent(server.db, userId, {
			timestamp: new Date("2020-01-16T12:00:00.000Z"),
		});

		const stats = await call(usageHandler.monthlyActiveUsers, { timeZone: "UTC" }, { context });

		expect(Array.isArray(stats.weeklyRequests)).toBe(true);
		const totalWeeklyRequests = stats.weeklyRequests.reduce(
			(total, bucket) => total + bucket.requests,
			0,
		);
		expect(totalWeeklyRequests).toBe(2);
		// Both events fall in the same ISO week (Mon 2020-01-13), so one bucket holds them.
		const weekWithRequests = stats.weeklyRequests.find((bucket) => bucket.requests > 0);
		expect(weekWithRequests?.requests).toBe(2);
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
