import { describe, expect, test } from "bun:test";

import { resolveScribeUsageLimit } from "@/orpc/scribe/handlers/usage-limit";

describe("Scribe usage limits", () => {
	test("returns free-tier limit when subscription is inactive", () => {
		expect(resolveScribeUsageLimit(false)).toBe(50);
	});

	test("returns plus-tier limit when subscription is active", () => {
		expect(resolveScribeUsageLimit(true)).toBe(500);
	});
});
