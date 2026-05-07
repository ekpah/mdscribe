import { describe, expect, test } from "bun:test";

import { buildUsageEventData } from "@/lib/usage-logging";
import { redactIfZdrEnabled } from "@/orpc/scribe/handlers/usage-logging";

describe("Scribe usage logging", () => {
	test("redacts content when ZDR is enabled", () => {
		expect(redactIfZdrEnabled(true, "sensitive output")).toBe(
			"[zdr - content redacted]",
		);
	});

	test("keeps content when ZDR is disabled", () => {
		expect(redactIfZdrEnabled(false, "normal output")).toBe("normal output");
	});

	test("returns empty string for missing value when ZDR is disabled", () => {
		expect(redactIfZdrEnabled(false, undefined)).toBe("");
	});

	test("stores rounded request duration timings", () => {
		const usageEvent = buildUsageEventData({
			name: "ai_scribe_generation",
			timing: {
				timeToCompletionMs: 2450.6,
				timeToFirstTokenMs: 350.2,
			},
			userId: "user-1",
		});

		expect(usageEvent.timeToCompletionMs).toBe(2451);
		expect(usageEvent.timeToFirstTokenMs).toBe(350);
	});
});
