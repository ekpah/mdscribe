import { describe, expect, test } from "bun:test";

import {
	hasLessThanTenPercentUsageRemaining,
	isSuccessfulChatFinish,
} from "@/lib/aiscribe-toasts";

describe("AI Scribe toast decisions", () => {
	test("shows success only for a completed generation", () => {
		expect(
			isSuccessfulChatFinish({
				finishReason: "stop",
				isAbort: false,
				isError: false,
			}),
		).toBe(true);
	});

	test("does not show success after a stream error", () => {
		expect(
			isSuccessfulChatFinish({
				finishReason: undefined,
				isAbort: false,
				isError: true,
			}),
		).toBe(false);
		expect(
			isSuccessfulChatFinish({
				finishReason: "stop",
				isAbort: false,
				isError: true,
			}),
		).toBe(false);
		expect(
			isSuccessfulChatFinish({
				finishReason: "error",
				isAbort: false,
				isError: false,
			}),
		).toBe(false);
	});

	test("does not show success after an abort or content filter", () => {
		expect(
			isSuccessfulChatFinish({
				finishReason: "stop",
				isAbort: true,
				isError: false,
			}),
		).toBe(false);
		expect(
			isSuccessfulChatFinish({
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
