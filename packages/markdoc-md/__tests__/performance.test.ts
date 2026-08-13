import { describe, expect, test } from "bun:test";

import { analyzeMarkdocTemplate } from "../parse/parse-markdoc-to-inputs";

describe("template analysis performance", () => {
	test("validates, transforms, and discovers 1,000 inputs within the interaction budget", () => {
		const content = Array.from(
			{ length: 1000 },
			(_, index) => `{% info "value_${index}" type="number" /%}`,
		).join("\n");
		const startedAt = performance.now();
		const analysis = analyzeMarkdocTemplate(content);
		const elapsed = performance.now() - startedAt;

		expect(analysis.diagnostics).toEqual([]);
		expect(analysis.inputs).toHaveLength(1000);
		expect(elapsed).toBeLessThan(500);
	});
});
