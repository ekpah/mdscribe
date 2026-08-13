import { describe, expect, test } from "bun:test";

import { validateMarkdocTemplate } from "../parse/validate-markdoc-template";

const codes = (content: string) =>
	validateMarkdocTemplate(content).map((diagnostic) => diagnostic.code);

describe("complete Markdoc template validation", () => {
	test("accepts a valid inline citation", () => {
		expect(
			validateMarkdocTemplate(
				`{% cite source="https://example.test" quote="alpha" %}alpha **bold**{% /cite %}`,
			),
		).toEqual([]);
	});

	test("reports missing and semantically invalid sources", () => {
		expect(codes("{% cite %}missing{% /cite %}")).toContain("markdoc-schema");
		expect(codes(`{% cite source="" %}empty{% /cite %}`)).toContain(
			"citation-source-invalid",
		);
		expect(codes(`{% cite source="http://example.test" %}unsafe{% /cite %}`)).toContain(
			"citation-source-invalid",
		);
	});

	test("rejects cross-tag, link, nested, and block-spanning citation bodies", () => {
		for (const content of [
			`{% cite source="https://example.test" %}[link](https://other.test){% /cite %}`,
			`{% cite source="https://example.test" %}{% info "x" /%}{% /cite %}`,
			`{% cite source="https://example.test" %}{% cite source="https://inner.test" %}x{% /cite %}{% /cite %}`,
			`{% cite source="https://example.test" %}first\n\nsecond{% /cite %}`,
		]) {
			expect(codes(content)).toContain("markdoc-schema");
		}
	});

	test("includes shared tag-contract diagnostics", () => {
		expect(
			codes(`{% info "x" type="string" /%}\n{% info "x" type="number" /%}`),
		).toContain("tag-settings-conflict");
	});

	test("rejects a malformed score formula without evaluating it", () => {
		const diagnostics = validateMarkdocTemplate(
			`{% score primary="risk" formula="([age]" /%}`,
		);
		expect(diagnostics).toContainEqual(
			expect.objectContaining({
				code: "markdoc-schema",
				id: "score-formula-invalid",
				severity: "error",
			}),
		);
	});
});
