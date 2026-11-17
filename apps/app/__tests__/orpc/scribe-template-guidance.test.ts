import { describe, expect, test } from "bun:test";

import { resolveFallbackTemplateByContextKey } from "@/orpc/scribe/context/template/fallbacks";
import { renderTemplateContext } from "@/orpc/scribe/context/template/guidance";

describe("Scribe template helpers", () => {
	test("resolves fallback template by prompt context key", () => {
		const fallbackTemplate = resolveFallbackTemplateByContextKey("discharge");
		const fallbackContextValue = renderTemplateContext(fallbackTemplate);

		expect(fallbackTemplate?.title).toBe("Standardstruktur Entlassbrief");
		expect(fallbackContextValue).toContain("<template_context>");
		expect(fallbackContextValue).toContain("<usage>");
		expect(fallbackContextValue).toContain("primäre Zielstruktur und stilistische Orientierung");
		expect(fallbackContextValue).toContain("<markdoc_tag_guidance>");
		expect(fallbackContextValue).toContain("Markdoc-Tags in der Vorlage sind nur Platzhalterlogik");
		expect(fallbackContextValue).toContain("kein {% ... %}");
		expect(fallbackContextValue.indexOf("<usage>")).toBeLessThan(
			fallbackContextValue.indexOf("<template>"),
		);
		expect(fallbackContextValue).toContain("<title>\nStandardstruktur Entlassbrief\n</title>");
	});

	test("resolves outpatient and befunde fallback templates", () => {
		const outpatientFallback = resolveFallbackTemplateByContextKey("outpatient_visit");
		const befundeFallback = resolveFallbackTemplateByContextKey("diagnostic_results");

		expect(outpatientFallback?.title).toBe("Standardstruktur Ambulanzbrief");
		expect(befundeFallback?.title).toBe("Standardstruktur Befunde");
	});
});
