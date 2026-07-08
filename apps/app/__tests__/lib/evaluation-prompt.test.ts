import { describe, expect, test } from "bun:test";

import {
	buildResponseComparisonPrompt,
	buildUsageEventEvaluationPrompt,
	CLINICAL_QUALITY_METRICS_PROMPT,
	RESPONSE_COMPARISON_SYSTEM_PROMPT,
	USAGE_EVENT_EVALUATION_SYSTEM_PROMPT,
} from "@/orpc/scribe/prompts/core/evaluation";

describe("evaluation prompt composition", () => {
	test("score and comparison prompts share the clinical quality metrics", () => {
		expect(USAGE_EVENT_EVALUATION_SYSTEM_PROMPT).toContain(CLINICAL_QUALITY_METRICS_PROMPT);
		expect(RESPONSE_COMPARISON_SYSTEM_PROMPT).toContain(CLINICAL_QUALITY_METRICS_PROMPT);
		expect(CLINICAL_QUALITY_METRICS_PROMPT).toContain(
			"nicht automatisch als vollständigen Arztbrief",
		);
		expect(CLINICAL_QUALITY_METRICS_PROMPT).toContain(
			"Faktentreue vor Klinischer Nutzbarkeit vor Struktur vor Sprache",
		);
	});

	test("prompt bodies frame responses as requested document components", () => {
		const usagePrompt = buildUsageEventEvaluationPrompt({
			documentType: "epikrise",
			inputs: { promptName: "epikrise", variables: { notes: "Kurzverlauf" } },
			response: "Entlassungsmanagement: Kontrolle beim Hausarzt.",
		});
		const comparisonPrompt = buildResponseComparisonPrompt({
			documentType: "epikrise",
			inputs: { promptName: "epikrise" },
			responses: {
				a: "Antwort A",
				b: "Antwort B",
			},
		});

		expect(usagePrompt).toContain("als angeforderten Dokumentbaustein");
		expect(usagePrompt).toContain('"notes": "Kurzverlauf"');
		expect(comparisonPrompt).toContain("als angeforderte Dokumentbausteine");
		expect(comparisonPrompt).toContain("Antwort A");
		expect(comparisonPrompt).toContain("Antwort B");
	});
});
