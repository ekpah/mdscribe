import { describe, expect, test } from "bun:test";

import { validateMarkdocTemplate } from "../parse/validate-markdoc-template";

const contractDiagnostics = validateMarkdocTemplate;

describe("condition and switch contracts", () => {
	test("categorical defaults are rendering-only and still validate their predicates", () => {
		const template = (attributes: string) =>
			`{% switch "kind" %}{% case "a" %}A{% /case %}{% case default=true ${attributes} %}fallback{% /case %}{% /switch %}`;
		expect(contractDiagnostics(template(""))).toEqual([]);
		expect(contractDiagnostics(template("value=2"))).toContainEqual(
			expect.objectContaining({ reason: "invalid-case-value" }),
		);
		expect(contractDiagnostics(template("gt=2"))).toContainEqual(
			expect.objectContaining({ reason: "conflicting-operators" }),
		);
		expect(contractDiagnostics(template('primary="a"'))).toContainEqual(
			expect.objectContaining({ reason: "primary-and-condition" }),
		);
	});
	test("accepts scalar and aligned vector conditions", () => {
		expect(
			contractDiagnostics(
				`{% condition "age" %}{% case gte=18 lt=65 %}adult{% /case %}{% case default=true %}other{% /case %}{% /condition %}`,
			),
		).toEqual([]);
		expect(
			contractDiagnostics(
				`{% condition primary=["age", "score"] unit="local" %}{% case gte=[18, null] lt=[null, 10] %}match{% /case %}{% /condition %}`,
			),
		).toEqual([]);
	});

	test("enforces condition defaults, values, vector source, and duplicate predicates", () => {
		const diagnostics = contractDiagnostics(
			`{% condition primary=["a", "b"] source="x" %}{% case eq=[1, null] value=[1, 2] %}one{% /case %}{% case eq=[1, null] %}again{% /case %}{% case default=true %}fallback{% /case %}{% case gt=[0, 0] %}late{% /case %}{% /condition %}`,
		);
		expect(diagnostics).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ reason: "group-source-unsupported" }),
				expect.objectContaining({ reason: "condition-case-value" }),
				expect.objectContaining({ reason: "duplicate-predicate" }),
				expect.objectContaining({ code: "case-unreachable" }),
			]),
		);
	});

	test("rejects numeric and array switches with migration diagnostics", () => {
		expect(
			contractDiagnostics(`{% switch "x" type="number" %}{% case eq=1 %}x{% /case %}{% /switch %}`),
		).toContainEqual(expect.objectContaining({ reason: "number-switch-unsupported" }));
		expect(
			contractDiagnostics(`{% switch primary=["x", "y"] %}{% case "a" %}x{% /case %}{% /switch %}`),
		).toContainEqual(expect.objectContaining({ reason: "array-switch-unsupported" }));
	});

	test("merges categorical mappings globally for formula-only calcs", () => {
		const valid = `{% switch "kind" %}{% case "a" value=1 %}A{% /case %}{% /switch %}{% switch "kind" %}{% case "b" value=2 %}B{% /case %}{% case "a" %}A again{% /case %}{% /switch %}{% calc "result" formula="[kind]+[undeclaredNumber]" /%}`;
		expect(contractDiagnostics(valid)).toEqual([]);

		const missing = contractDiagnostics(
			`{% switch "kind" %}{% case "a" value=1 %}A{% /case %}{% case "b" %}B{% /case %}{% /switch %}{% calc "result" formula="[kind]" /%}`,
		);
		expect(missing).toContainEqual(
			expect.objectContaining({ code: "calc-case-values-missing", caseKeys: ["b"] }),
		);
	});

	test("rejects conflicting global maps and repeated keys only within an occurrence", () => {
		const diagnostics = contractDiagnostics(
			`{% switch "kind" %}{% case "a" value=1 %}A{% /case %}{% case "a" value=1 %}again{% /case %}{% /switch %}{% switch "kind" %}{% case "a" value=2 %}conflict{% /case %}{% /switch %}`,
		);
		expect(diagnostics).toContainEqual(expect.objectContaining({ reason: "duplicate-predicate" }));
		expect(diagnostics).toContainEqual(expect.objectContaining({ code: "case-value-conflict" }));
	});

	test("formulas only use numeric variables", () => {
		const nonNumeric = (template: string) =>
			contractDiagnostics(template).flatMap((diagnostic) =>
				diagnostic.code === "calc-variable-not-numeric"
					? [`${diagnostic.variable}:${diagnostic.domain}`]
					: [],
			);
		expect(
			nonNumeric(`{% info "t" /%}{% info "d" type="date" /%}{% calc "r" formula="[t]+[d]" /%}`),
		).toEqual(["t:text", "d:date"]);
		expect(nonNumeric(`{% calc "r" formula="[t]" %}{% info "t" /%}{% /calc %}`)).toEqual([
			"t:text",
		]);
		// Number info, condition fields, calcs, checkboxes, and undeclared names are numeric.
		expect(
			nonNumeric(
				`{% info "n" type="number" /%}{% condition "c" %}{% case gt=1 %}x{% /case %}{% /condition %}{% calc "a" formula="1" /%}{% switch "f" type="checkbox" %}{% case "true" %}y{% /case %}{% /switch %}{% calc "r" formula="[n]+[c]+[a]+[f]+[free]" /%}`,
			),
		).toEqual([]);
	});

	test("uses boolean defaults independently for each unmapped key", () => {
		expect(
			contractDiagnostics(
				`{% switch "flag" type="checkbox" %}{% case "true" %}yes{% /case %}{% case "false" %}no{% /case %}{% /switch %}{% calc "result" formula="[flag]" /%}`,
			),
		).toEqual([]);
		expect(
			contractDiagnostics(
				`{% switch "flag" type="checkbox" %}{% case "true" value=5 %}yes{% /case %}{% case "false" %}no{% /case %}{% /switch %}{% calc "result" formula="[flag]" /%}`,
			),
		).toEqual([]);
	});
});
