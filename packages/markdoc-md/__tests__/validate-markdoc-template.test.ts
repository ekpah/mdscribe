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
		expect(codes(`{% cite source="" %}empty{% /cite %}`)).toContain("citation-source-invalid");
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

	test("includes shared variable-contract diagnostics", () => {
		expect(codes(`{% info "x" type="string" /%}\n{% info "x" type="number" /%}`)).toContain(
			"variable-domain-conflict",
		);
		expect(codes(`{% info "x" unit="mg" /%}\n{% info "x" unit="ml" /%}`)).toContain(
			"variable-settings-conflict",
		);
	});

	test("rejects a malformed calc formula without evaluating it", () => {
		const diagnostics = validateMarkdocTemplate(`{% calc primary="risk" formula="([age]" /%}`);
		expect(diagnostics).toContainEqual(
			expect.objectContaining({
				code: "markdoc-schema",
				id: "calc-formula-invalid",
				severity: "error",
			}),
		);
	});

	test("requires every calc formula component to be contained by the calc", () => {
		const diagnostics = validateMarkdocTemplate(
			`{% info "age" type="number" /%}{% calc primary="risk" formula="[age]+[missing]" %}{% info "age" type="number" /%}{% /calc %}`,
		);

		expect(diagnostics).toContainEqual(
			expect.objectContaining({
				calc: "risk",
				code: "calc-components-missing",
				missingComponents: ["missing"],
			}),
		);
	});

	test("requires and verifies numeric values for calc switch cases", () => {
		const missingValues = validateMarkdocTemplate(`
{% calc primary="risk" formula="[ageGroup]" %}
{% switch "ageGroup" %}
{% case "young" value=0 %}Young{% /case %}
{% case "old" %}Old{% /case %}
{% /switch %}
{% /calc %}
`);
		expect(missingValues).toContainEqual(
			expect.objectContaining({
				caseKeys: ["old"],
				code: "calc-case-values-missing",
				switch: "ageGroup",
			}),
		);

		const valid = validateMarkdocTemplate(
			`{% calc primary="risk" formula="[ageGroup]+[diabetes]" %}{% switch "ageGroup" %}{% case "young" value=0 %}Young{% /case %}{% case "old" value=2 %}Old{% /case %}{% /switch %}{% switch "diabetes" type="checkbox" %}{% case "true" %}Yes{% /case %}{% case "false" %}No{% /case %}{% /switch %}{% /calc %}`,
		);
		expect(valid).toEqual([]);
	});

	test("rejects conflicting numerical case values across repeated switches", () => {
		const diagnostics = validateMarkdocTemplate(`
{% switch "ageGroup" %}{% case "old" value=1 %}Old{% /case %}{% /switch %}
{% switch "ageGroup" %}{% case "old" value=2 %}Older{% /case %}{% /switch %}
`);
		expect(diagnostics).toContainEqual(
			expect.objectContaining({
				caseKey: "old",
				code: "case-value-conflict",
				conflictingValue: 2,
				firstValue: 1,
				switch: "ageGroup",
			}),
		);
	});
});
