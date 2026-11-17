import { describe, expect, test } from "bun:test";

import { renderTemplateContext } from "@/orpc/scribe/context/template/guidance";

describe("Scribe template helpers", () => {
	test("renders a template with usage and tag guidance before the template", () => {
		const fallbackContextValue = renderTemplateContext({
			content: "Entlassbrief {% ai %}Epikrise{% /ai %}",
			examples: [],
			title: "Standardstruktur Entlassbrief",
		});

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
});
