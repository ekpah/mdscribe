import { describe, expect, test } from "bun:test";

import { getScribeUsageBudgetPercentage, PRODUCT_PLANS } from "@/lib/product-plans";

describe("Scribe usage limits", () => {
	test("caps user-facing usage progress at 100%", () => {
		expect(
			getScribeUsageBudgetPercentage({
				monthlyCostLimit: PRODUCT_PLANS.free.scribeMonthlyCostLimit,
				totalCost: 1,
			}),
		).toBe(67);
		expect(
			getScribeUsageBudgetPercentage({
				monthlyCostLimit: PRODUCT_PLANS.free.scribeMonthlyCostLimit,
				totalCost: 3,
			}),
		).toBe(100);
	});
});
