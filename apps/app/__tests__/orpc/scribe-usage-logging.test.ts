import { describe, expect, test } from "bun:test";

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
});
