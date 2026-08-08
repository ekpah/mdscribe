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
			"nicht automatisch die Bewertung eines vollständigen Arztbriefs",
		);
		expect(CLINICAL_QUALITY_METRICS_PROMPT).toContain(
			"Inhalte anderer Briefteile zählen nicht als Lücke",
		);
		expect(USAGE_EVENT_EVALUATION_SYSTEM_PROMPT).toContain("exakt 9 Kategorien");
		expect(USAGE_EVENT_EVALUATION_SYSTEM_PROMPT).toContain('9. "Innere Konsistenz"');
		expect(USAGE_EVENT_EVALUATION_SYSTEM_PROMPT).toContain("score ist eine ganze Zahl von 1 bis 5");
	});

	test("score prompt includes the exact harness and target template scope", () => {
		const usagePrompt = buildUsageEventEvaluationPrompt({
			documentType: "epikrise",
			inputs: { promptName: "epikrise", variables: { notes: "Kurzverlauf" } },
			promptContext: {
				harnessId: "epikrise",
				harnessInstructions: "Erstelle ausschließlich die Epikrise.",
				promptLabel: "Epikrise",
				targetField: "epikrise",
				template: {
					content: "# Epikrise\n(( Verlauf ))",
					information: "Die Diagnosen stehen in einem anderen Briefteil.",
					source: "selected",
					title: "Kurze Epikrise",
				},
			},
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
		expect(usagePrompt).toContain('"targetField": "epikrise"');
		expect(usagePrompt).toContain('"title": "Kurze Epikrise"');
		expect(usagePrompt).toContain("Die Diagnosen stehen in einem anderen Briefteil.");
		expect(comparisonPrompt).toContain("als angeforderte Dokumentbausteine");
		expect(comparisonPrompt).toContain("Antwort A");
		expect(comparisonPrompt).toContain("Antwort B");
	});
});
