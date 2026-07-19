import { describe, expect, test } from "bun:test";

import {
	hasLessThanTenPercentUsageRemaining,
	isSuccessfulAiscribeFinish,
} from "@/lib/aiscribe-toasts";

describe("AI Scribe toast decisions", () => {
	test("shows success only for a completed generation", () => {
		expect(
			isSuccessfulAiscribeFinish({
				finishReason: "stop",
				isAbort: false,
				isError: false,
			}),
		).toBe(true);
	});

	test("does not show success after a stream error", () => {
		expect(
			isSuccessfulAiscribeFinish({
				finishReason: undefined,
				isAbort: false,
				isError: true,
			}),
		).toBe(false);
		expect(
			isSuccessfulAiscribeFinish({
				finishReason: "error",
				isAbort: false,
				isError: false,
			}),
		).toBe(false);
	});

	test("does not show success after an abort or content filter", () => {
		expect(
			isSuccessfulAiscribeFinish({
				finishReason: "stop",
				isAbort: true,
				isError: false,
			}),
		).toBe(false);
		expect(
			isSuccessfulAiscribeFinish({
				finishReason: "content-filter",
				isAbort: false,
				isError: false,
			}),
		).toBe(false);
	});

	test("warns only when less than ten percent remains", () => {
		expect(hasLessThanTenPercentUsageRemaining(90)).toBe(false);
		expect(hasLessThanTenPercentUsageRemaining(91)).toBe(true);
		expect(hasLessThanTenPercentUsageRemaining(100)).toBe(true);
	});
});
