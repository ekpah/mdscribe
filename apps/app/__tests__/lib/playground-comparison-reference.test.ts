import { describe, expect, test } from "bun:test";

import { resolvePlaygroundComparisonReference } from "@/app/admin/playground/_lib/comparison-reference";

describe("playground comparison reference", () => {
	test("uses the usage-event response before any generated result", () => {
		expect(
			resolvePlaygroundComparisonReference({
				firstResult: {
					id: "first-run",
					isStreaming: false,
					text: "Generierte Antwort",
				},
				usageEventResponse: "  Gespeicherte Usage-Event-Antwort  ",
			}),
		).toEqual({
			label: "der Usage-Event-Antwort",
			text: "Gespeicherte Usage-Event-Antwort",
		});
	});

	test("uses the first completed result when no usage-event response exists", () => {
		expect(
			resolvePlaygroundComparisonReference({
				firstResult: {
					id: "first-run",
					isStreaming: false,
					text: "  Erste generierte Antwort  ",
				},
				usageEventResponse: undefined,
			}),
		).toEqual({
			label: "dem ersten Ergebnis",
			runId: "first-run",
			text: "Erste generierte Antwort",
		});
	});

	test("waits for the first result to finish before enabling a comparison", () => {
		expect(
			resolvePlaygroundComparisonReference({
				firstResult: {
					id: "first-run",
					isStreaming: true,
					text: "Teilantwort",
				},
				usageEventResponse: undefined,
			}),
		).toBeNull();
	});
});
