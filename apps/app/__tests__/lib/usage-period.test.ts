import { describe, expect, test } from "bun:test";

import { resolveMonthlyUsagePeriod } from "@/lib/usage-period";

describe("monthly usage periods", () => {
	test("uses UTC calendar months for users without a subscription", () => {
		const period = resolveMonthlyUsagePeriod({
			hasActiveSubscription: false,
			now: new Date("2026-07-31T22:30:00.000Z"),
		});

		expect(period).toEqual({
			end: new Date("2026-08-01T00:00:00.000Z"),
			start: new Date("2026-07-01T00:00:00.000Z"),
			type: "calendar",
		});
	});

	test("uses the current Stripe period for monthly subscriptions", () => {
		const period = resolveMonthlyUsagePeriod({
			hasActiveSubscription: true,
			now: new Date("2026-07-31T12:00:00.000Z"),
			subscriptionPeriodEnd: new Date("2026-08-15T09:30:00.000Z"),
			subscriptionPeriodStart: new Date("2026-07-15T09:30:00.000Z"),
		});

		expect(period).toEqual({
			end: new Date("2026-08-15T09:30:00.000Z"),
			start: new Date("2026-07-15T09:30:00.000Z"),
			type: "subscription",
		});
	});

	test("creates monthly windows inside an annual subscription", () => {
		const period = resolveMonthlyUsagePeriod({
			hasActiveSubscription: true,
			now: new Date("2026-07-20T12:00:00.000Z"),
			subscriptionPeriodEnd: new Date("2027-01-15T09:30:00.000Z"),
			subscriptionPeriodStart: new Date("2026-01-15T09:30:00.000Z"),
		});

		expect(period).toEqual({
			end: new Date("2026-08-15T09:30:00.000Z"),
			start: new Date("2026-07-15T09:30:00.000Z"),
			type: "subscription",
		});
	});

	test("preserves a month-end anchor without drifting after February", () => {
		const period = resolveMonthlyUsagePeriod({
			hasActiveSubscription: true,
			now: new Date("2026-03-15T12:00:00.000Z"),
			subscriptionPeriodEnd: new Date("2027-01-31T09:30:00.000Z"),
			subscriptionPeriodStart: new Date("2026-01-31T09:30:00.000Z"),
		});

		expect(period).toEqual({
			end: new Date("2026-03-31T09:30:00.000Z"),
			start: new Date("2026-02-28T09:30:00.000Z"),
			type: "subscription",
		});
	});

	test("starts a new window exactly at the reset boundary", () => {
		const period = resolveMonthlyUsagePeriod({
			hasActiveSubscription: true,
			now: new Date("2026-02-15T09:30:00.000Z"),
			subscriptionPeriodEnd: new Date("2026-02-15T09:30:00.000Z"),
			subscriptionPeriodStart: new Date("2026-01-15T09:30:00.000Z"),
		});

		expect(period).toEqual({
			end: new Date("2026-03-15T09:30:00.000Z"),
			start: new Date("2026-02-15T09:30:00.000Z"),
			type: "subscription",
		});
	});
});
