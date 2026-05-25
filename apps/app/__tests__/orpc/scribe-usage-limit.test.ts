import { describe, expect, test } from "bun:test";

import { PRODUCT_PLANS } from "@/lib/product-plans";

describe("Scribe usage limits", () => {
	test("returns free-tier limit when subscription is inactive", () => {
		expect(PRODUCT_PLANS.free.scribeUsageLimit).toBe(50);
	});

	test("returns plus-tier limit when subscription is active", () => {
		expect(PRODUCT_PLANS.plus.scribeUsageLimit).toBe(500);
	});
});
