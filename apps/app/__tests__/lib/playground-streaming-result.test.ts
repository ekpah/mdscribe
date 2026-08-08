import { describe, expect, test } from "bun:test";

import { resolveStreamingPlaygroundResult } from "@/app/admin/playground/_lib/streaming-result";
import type { PlaygroundResult } from "@/app/admin/playground/_lib/types";

const persistedResult: PlaygroundResult = {
	isStreaming: true,
	metrics: { latencyMs: 0 },
	text: "",
};

describe("playground streaming result", () => {
	test("overlays live chat output without mutating persisted parent state", () => {
		const result = resolveStreamingPlaygroundResult({
			completion: "Live completion",
			isRunning: true,
			reasoning: "Live reasoning",
			result: persistedResult,
		});

		expect(result).toEqual({
			isStreaming: true,
			metrics: { latencyMs: 0 },
			reasoning: "Live reasoning",
			text: "Live completion",
		});
		expect(persistedResult).toEqual({
			isStreaming: true,
			metrics: { latencyMs: 0 },
			text: "",
		});
	});

	test("keeps the persisted result reference after streaming finishes", () => {
		const result = resolveStreamingPlaygroundResult({
			completion: "Stale live completion",
			isRunning: false,
			reasoning: "",
			result: persistedResult,
		});

		expect(result).toBe(persistedResult);
	});
});
