import { describe, expect, test } from "bun:test";

import { composeScribeContextPrompt } from "@/orpc/scribe/context";
import {
	buildTemplateFallbackContext,
	buildSelectedTemplateReference,
	parseSelectedTemplateReference,
	resolveFallbackTemplateByContextKey,
	resolveSelectedTemplateContext,
} from "@/orpc/scribe/context/template";

describe("Scribe template helpers", () => {
	test("resolves fallback template by prompt context key", () => {
		const fallbackTemplate = resolveFallbackTemplateByContextKey("discharge");
		const fallbackContext = buildTemplateFallbackContext(fallbackTemplate);
		const fallbackContextValue = fallbackContext ?? "";

		expect(fallbackTemplate?.title).toBe("Standardstruktur Entlassbrief");
		expect(fallbackContextValue).toContain("<template_context>");
		expect(fallbackContextValue).toContain("<usage>");
		expect(fallbackContextValue).toContain(
			"primäre Zielstruktur und stilistische Orientierung",
		);
		expect(fallbackContextValue).toContain("<markdoc_tag_guidance>");
		expect(fallbackContextValue).toContain(
			"Markdoc-Tags in der Vorlage sind nur Platzhalterlogik",
		);
		expect(fallbackContextValue).toContain("kein {% ... %}");
		expect(fallbackContextValue.indexOf("<usage>")).toBeLessThan(
			fallbackContextValue.indexOf("<template>"),
		);
		expect(fallbackContextValue).toContain(
			"<title>\nStandardstruktur Entlassbrief\n</title>",
		);
	});

	test("resolves outpatient and befunde fallback templates", () => {
		const outpatientFallback = resolveFallbackTemplateByContextKey("outpatient_visit");
		const befundeFallback = resolveFallbackTemplateByContextKey("diagnostic_results");

		expect(outpatientFallback?.title).toBe("Standardstruktur Ambulanzbrief");
		expect(befundeFallback?.title).toBe("Standardstruktur Befunde");
	});

	test("resolveSelectedTemplateContext parses selected template reference", () => {
		const selectedTemplate = resolveSelectedTemplateContext(
			"## Eigene Vorlage\n\nTitel: Eigene Vorlage\n\n## Abschnitt\nInhalt\n\n## Beispiele\n\n### Beispiel 1\n\nBeispiel A\n\n### Beispiel 2\n\nBeispiel B",
		);
		const selectedTemplateContext = buildTemplateFallbackContext(selectedTemplate);

		expect(selectedTemplate?.title).toBe("Eigene Vorlage");
		expect(selectedTemplate?.content).toContain("## Abschnitt");
		expect(selectedTemplate?.examples).toEqual(["Beispiel A", "Beispiel B"]);
		expect(selectedTemplateContext).toContain("<template_context>");
		expect(selectedTemplateContext).toContain("<title>\nEigene Vorlage\n</title>");
		expect(selectedTemplateContext).toContain("<examples>");
		expect(selectedTemplateContext).toContain("<example>\nBeispiel A\n</example>");
	});

	test("composeScribeContextPrompt keeps date line before context block", () => {
		const prompt = composeScribeContextPrompt({
			contextXml: "<context>\n<patient_context>abc</patient_context>\n</context>",
			todaysDate: "11.03.2026",
		});

		expect(prompt.indexOf("Das heutige Datum ist der 11.03.2026.")).toBeLessThan(
			prompt.indexOf("<context>"),
		);
	});

	test("parseSelectedTemplateReference extracts title and content", () => {
		const reference = buildSelectedTemplateReference({
			content: "## Abschnitt\nInhalt",
			examples: ["Beispiel A"],
			information: "Beginne mit einer knappen Zusammenfassung.",
			title: "Echo Vorlage",
		});

		const parsed = parseSelectedTemplateReference(reference);
		expect(parsed.title).toBe("Echo Vorlage");
		expect(parsed.content).toContain("## Abschnitt");
		expect(parsed.examples).toEqual(["Beispiel A"]);
		expect(parsed.information).toBe("Beginne mit einer knappen Zusammenfassung.");
		expect(parsed.content).not.toContain("## Ausgewaehlte Vorlage (Referenz)");
		expect(parsed.content).not.toContain("## Beispiele");
		expect(parsed.content).not.toContain("Beispiele:");
		expect(parsed.content).not.toContain("## Informationen");

		const context = buildTemplateFallbackContext(parsed);
		expect(context).toContain(
			"<information>\nBeginne mit einer knappen Zusammenfassung.\n</information>",
		);
		expect(context).toContain("Befolge <information> als verbindliche Zusatzanweisungen");
	});

	test("multi-paragraph examples survive the reference round-trip", () => {
		const examples = [
			"# Epikrise\n\nDer Patient stellte sich notfallmäßig vor.\n\nBei Aufnahme zeigte sich ein erhöhtes CRP.\n\n# Procedere\n\n- Laborkontrolle beim Hausarzt\n- Stationäre Wiederaufnahme",
			"# Epikrise\n\nZweiter Fall mit eigenem Verlauf.\n\nEntlassung in stabilem Zustand.",
		];
		const reference = buildSelectedTemplateReference({
			content: "## Abschnitt\nInhalt",
			examples,
			title: "Epikrise Vorlage",
		});

		const parsed = parseSelectedTemplateReference(reference);
		expect(parsed.examples).toEqual(examples);

		const templateContext = buildTemplateFallbackContext(
			resolveSelectedTemplateContext(reference),
		);
		const exampleCount = (templateContext ?? "").split("<example>").length - 1;
		expect(exampleCount).toBe(2);
	});
});
