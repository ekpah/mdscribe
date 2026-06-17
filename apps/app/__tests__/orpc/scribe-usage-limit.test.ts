import { describe, expect, test } from "bun:test";

import {
	getScribeUsageBudgetPercentage,
	PRODUCT_PLANS,
} from "@/lib/product-plans";

describe("Scribe usage limits", () => {
	test("returns free-tier monthly cost budget when subscription is inactive", () => {
		expect(PRODUCT_PLANS.free.scribeMonthlyCostLimit).toBe(2);
	});

	test("returns plus-tier monthly cost budget when subscription is active", () => {
		expect(PRODUCT_PLANS.plus.scribeMonthlyCostLimit).toBe(8);
	});

	test("caps user-facing usage progress at 100%", () => {
		expect(
			getScribeUsageBudgetPercentage({
				monthlyCostLimit: PRODUCT_PLANS.free.scribeMonthlyCostLimit,
				totalCost: 1,
			}),
		).toBe(50);
		expect(
			getScribeUsageBudgetPercentage({
				monthlyCostLimit: PRODUCT_PLANS.free.scribeMonthlyCostLimit,
				totalCost: 3,
			}),
		).toBe(100);
	});
});
