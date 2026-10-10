import { describe, expect, test } from "bun:test";

import Markdoc from "@markdoc/markdoc";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
	analyzeMarkdocTemplate,
	buildVariableContracts,
	parseConditionCase,
	selectConditionCase,
	toNumericValue,
	validateMarkdocTemplate,
} from "../index";
import { DynamicMarkdocRenderer } from "../react";

const reasons = (content: string) =>
	validateMarkdocTemplate(content).map((diagnostic) =>
		"reason" in diagnostic ? diagnostic.reason : diagnostic.code,
	);

const PSA_TEMPLATE = `{% condition "psa" unit="ng/ml" %}{% case lt=4 %}PSA im Normbereich.{% /case %}{% case gte=4 lt=10 %}PSA in der Grauzone.{% /case %}{% case default=true %}PSA deutlich erhöht.{% /case %}{% /condition %}`;

describe("condition evaluation", () => {
	test("first matching scalar case in document order wins", () => {
		const cases = [{ lt: 4 }, { gte: 4, lt: 10 }, { default: true }];
		expect(selectConditionCase("x", cases, { x: 3.9 })).toBe(0);
		expect(selectConditionCase("x", cases, { x: 4 })).toBe(1);
		expect(selectConditionCase("x", cases, { x: "4,5" })).toBe(1);
		expect(selectConditionCase("x", cases, { x: 25 })).toBe(2);
	});

	test("an unset value only matches a default case", () => {
		expect(selectConditionCase("x", [{ lt: 4 }, { gte: 4 }], {})).toBeNull();
		expect(selectConditionCase("x", [{ lt: 4 }, { default: true }], { x: "" })).toBe(1);
	});

	const alternatives = [{ gt: [11, null] }, { gt: [null, 14] }, { default: true }];
	for (const [a, b, expected] of [
		[12, 5, 0],
		[8, 15, 1],
		[12, 15, 0],
		[11, 14, 2],
		[12, undefined, 0],
		[undefined, 15, 1],
	] as const) {
		test(`positional alternatives select case ${expected} for ${a}/${b}`, () => {
			expect(selectConditionCase(["a", "b"], alternatives, { a, b })).toBe(expected);
		});
	}

	test("comparisons combine with AND across members and operators", () => {
		const cases = [{ gt: [11, null], lte: [null, 14] }];
		for (const values of [{ a: 12, b: 15 }, { a: 11, b: 14 }, { a: 12 }]) {
			expect(selectConditionCase(["a", "b"], cases, values)).toBeNull();
		}
		expect(selectConditionCase(["a", "b"], cases, { a: 12, b: 14 })).toBe(0);
	});

	for (const [primary, attributes, issue] of [
		[["a", "b"], { gt: [11] }, "invalid-literal"],
		[["a", "b"], { gt: 11 }, "invalid-literal"],
		[["a", "b"], { gt: [11, "bad"] }, "invalid-literal"],
		["a", { gt: [11] }, "invalid-literal"],
		["a", { gt: null }, "invalid-literal"],
		[["a", "b"], { gt: [null, null] }, "missing-condition"],
		["a", {}, "missing-condition"],
		[["a", "b"], { default: true, gt: [11, null] }, "conflicting-operators"],
	] as const) {
		test(`malformed case ${JSON.stringify(attributes)} never matches`, () => {
			expect(parseConditionCase(attributes, primary)).toBe(issue);
			expect(selectConditionCase(primary, [attributes], { a: 20, b: 20 })).toBeNull();
		});
	}

	test("coerces numeric strings including decimal commas", () => {
		expect(toNumericValue("4,5")).toBe(4.5);
		expect(toNumericValue("4.5")).toBe(4.5);
		expect(toNumericValue(true)).toBe(1);
		expect(toNumericValue("")).toBeNull();
		expect(toNumericValue("abc")).toBeNull();
	});
});

describe("condition validation", () => {
	test("accepts scalar and aligned array conditions", () => {
		expect(validateMarkdocTemplate(PSA_TEMPLATE)).toEqual([]);
		expect(
			validateMarkdocTemplate(
				`{% condition ["age", "score"] unit="local" %}{% case gte=[18, null] lt=[null, 10] %}match{% /case %}{% /condition %}`,
			),
		).toEqual([]);
	});

	test("rejects malformed, unsatisfiable, and keyed cases", () => {
		const condition = (cases: string, primary = '"x"') =>
			`{% condition ${primary} %}${cases}{% /condition %}`;
		expect(reasons(condition("{% case gt=1 gte=2 %}a{% /case %}"))).toContain(
			"conflicting-operators",
		);
		expect(reasons(condition("{% case gte=10 lt=4 %}a{% /case %}"))).toContain("empty-range");
		expect(reasons(condition('{% case "low" lt=4 %}a{% /case %}'))).toContain(
			"primary-and-condition",
		);
		expect(reasons(condition("{% case %}a{% /case %}"))).toContain("missing-condition");
		expect(reasons(condition("{% case gt=1 value=2 %}a{% /case %}"))).toContain(
			"condition-case-value",
		);
		expect(reasons(condition("{% case gt=[1] %}a{% /case %}"))).toContain("invalid-literal");
		expect(
			reasons(condition("{% case default=true %}a{% /case %}{% case lt=4 %}b{% /case %}")),
		).toContain("case-unreachable");
		expect(reasons(condition("{% case gt=1 %}a{% /case %}", '["x", "x"]'))).toContain(
			"invalid-members",
		);
		expect(
			reasons(
				`{% condition ["a", "b"] source="x" %}{% case gt=[1,null] %}a{% /case %}{% /condition %}`,
			),
		).toContain("group-source-unsupported");
	});

	test("rejects duplicate scalar and positional sibling predicates", () => {
		for (const [primary, condition] of [
			['"a"', "gt=11"],
			['["a","b"]', "gt=[11,null]"],
		]) {
			expect(
				reasons(
					`{% condition ${primary} %}{% case ${condition} %}first{% /case %}{% case ${condition} %}second{% /case %}{% /condition %}`,
				),
			).toContain("duplicate-predicate");
		}
	});

	test("numeric switches are invalid and point to condition", () => {
		expect(
			reasons(`{% switch "x" type="number" %}{% case lt=4 %}a{% /case %}{% /switch %}`),
		).toEqual(expect.arrayContaining(["markdoc-schema", "number-switch-unsupported"]));
		expect(reasons(`{% switch "x" %}{% case lt=4 %}a{% /case %}{% /switch %}`)).toEqual([
			"comparison-in-switch",
		]);
		expect(reasons(`{% switch ["x", "y"] %}{% case "a" %}x{% /case %}{% /switch %}`)).toContain(
			"array-switch-unsupported",
		);
	});

	test("a switch default may stand before keyed cases", () => {
		expect(
			reasons(
				`{% switch "s" %}{% case default=true %}Bitte wählen{% /case %}{% case "a" %}A{% /case %}{% /switch %}`,
			),
		).toEqual([]);
	});

	test("rejects switch cases without an option key", () => {
		expect(
			reasons(
				`{% switch "s" %}{% case %}keyless{% /case %}{% case "a" %}A{% /case %}{% /switch %}`,
			),
		).toContain("missing-option");
		expect(
			reasons(
				`{% switch "s" %}{% case "a" %}A{% /case %}{% case default=true %}B{% /case %}{% /switch %}`,
			),
		).toEqual([]);
	});

	test("rejects calculations that depend on themselves", () => {
		const diagnostics = validateMarkdocTemplate(
			`{% calc "a" formula="[b]+1" /%}{% calc "b" formula="[a]*2" /%}{% calc "c" formula="[a]" /%}{% calc "d" formula="[d]" /%}`,
		);
		expect(
			diagnostics.flatMap((diagnostic) =>
				diagnostic.code === "calc-cycle" ? [diagnostic.calc] : [],
			),
		).toEqual(["a", "b", "d"]);
	});

	test("rejects a case outside any switch or condition", () => {
		expect(reasons(`{% case "stray" %}lost{% /case %}`)).toContain("orphan-case");
	});
});

describe("condition variables", () => {
	test("info and condition share one numeric variable", () => {
		const template = `{% info "psa" type="number" unit="ng/ml" /%}\n${PSA_TEMPLATE}`;
		expect(validateMarkdocTemplate(template)).toEqual([]);
		const contract = buildVariableContracts(Markdoc.parse(template)).contracts.get("psa");
		expect(contract).toMatchObject({
			domain: "number",
			roles: { computed: false, field: true, selector: true },
			unit: "ng/ml",
		});
	});

	test("array members are numeric variables without group metadata", () => {
		const { contracts } = buildVariableContracts(
			Markdoc.parse(
				`{% condition ["a", "b"] unit="mm" %}{% case gt=[1, null] %}x{% /case %}{% /condition %}`,
			),
		);
		expect(contracts.get("a")?.domain).toBe("number");
		expect(contracts.get("a")?.unit).toBeUndefined();
		expect(contracts.get("b")?.roles.selector).toBe(true);
	});

	test("a text info or a switch conflicts with a condition", () => {
		expect(reasons(`{% info "psa" /%}\n${PSA_TEMPLATE}`)).toContain("variable-domain-conflict");
		expect(
			reasons(`{% switch "psa" %}{% case "a" %}A{% /case %}{% /switch %}\n${PSA_TEMPLATE}`),
		).toContain("variable-domain-conflict");
	});

	test("calc and condition may share a variable", () => {
		expect(
			validateMarkdocTemplate(
				`{% calc "score" formula="[a]+[b]" /%}{% condition "score" %}{% case lt=2 %}niedrig{% /case %}{% case default=true %}hoch{% /case %}{% /condition %}`,
			),
		).toEqual([]);
	});
});

describe("condition input extraction", () => {
	for (const infoFirst of [false, true]) {
		test(`a nested mention never hides the independent input (info first: ${infoFirst})`, () => {
			const conditions = `{% condition "ivsd" %}{% case gt=11 %}hypertrophiert{% /case %}{% case default=true %}{% condition "lvpwd" %}{% case gt=11 %}hypertrophiert{% /case %}{% case default=true %}normal groß{% /case %}{% /condition %}{% /case %}{% /condition %}`;
			const infos = `{% info "ivsd" type="number" unit="mm" /%} {% info "lvpwd" type="number" unit="mm" description="Hinterwanddicke" /%}`;
			const { inputs, diagnostics } = analyzeMarkdocTemplate(
				infoFirst ? `${infos}\n${conditions}\n${infos}` : `${conditions}\n${infos}\n${infos}`,
			);
			expect(diagnostics).toEqual([]);
			const independent = inputs.filter((input) => !input.visibility);
			expect(independent.map((input) => input.attributes.primary).sort()).toEqual([
				"ivsd",
				"lvpwd",
			]);
			expect(independent.find((input) => input.attributes.primary === "lvpwd")).toMatchObject({
				attributes: { description: "Hinterwanddicke", type: "number", unit: "mm" },
				name: "Info",
			});
			const nested = inputs.find((input) => input.visibility);
			expect(nested).toMatchObject({ attributes: { primary: "lvpwd" }, name: "Info" });
		});
	}

	test("keeps repeated inputs in separate cases and at top level", () => {
		const field = `{% info "note" /%}`;
		const { inputs } = analyzeMarkdocTemplate(
			`{% switch "choice" %}{% case "a" %}${field}{% /case %}{% case "b" %}${field}{% /case %}{% /switch %}\n${field}\n${field}`,
		);
		expect(inputs.map((input) => input.attributes.primary)).toEqual(["choice", "note"]);
		for (const branch of inputs[0]!.children) {
			expect(branch.children.map((child) => child.attributes.primary)).toEqual(["note"]);
		}
	});

	test("keeps explicit calc components alongside independent inputs", () => {
		const { inputs } = analyzeMarkdocTemplate(
			`{% calc "total" formula="[a]*2" %}{% info "a" type="number" unit="mm" /%}{% /calc %}\n{% info "a" type="number" unit="mm" /%}`,
		);
		expect(inputs.map((input) => input.attributes.primary)).toEqual(["total", "a"]);
		expect(inputs[0]?.children[0]?.attributes).toMatchObject({ primary: "a", unit: "mm" });
	});

	test("a calc replaces an info or condition field of the same name", () => {
		const { inputs } = analyzeMarkdocTemplate(`{% info "score" type="number" unit="Punkte" /%}
{% condition "score" %}{% case lt=2 %}niedrig {% info "note" /%}{% /case %}{% /condition %}
{% calc "score" formula="[a]" %}{% info "a" type="number" /%}{% /calc %}`);
		const score = inputs.filter((input) => input.attributes.primary === "score");
		expect(score).toHaveLength(1);
		expect(score[0]).toMatchObject({ attributes: { unit: "Punkte" }, name: "Calc" });
		expect(inputs.some((input) => input.attributes.primary === "note")).toBe(true);
	});
});

describe("condition rendering", () => {
	const render = (markdocContent: string, variables: Record<string, unknown>) =>
		renderToStaticMarkup(
			React.createElement(DynamicMarkdocRenderer, { markdocContent, variables }),
		);

	test("renders only the first matching case", () => {
		expect(render(PSA_TEMPLATE, { psa: 2 })).toContain("Normbereich");
		expect(render(PSA_TEMPLATE, { psa: 2 })).not.toContain("Grauzone");
		expect(render(PSA_TEMPLATE, { psa: "4,5" })).toContain("Grauzone");
		expect(render(PSA_TEMPLATE, { psa: 25 })).toContain("deutlich erhöht");
	});

	test("renders only the default case when the value is unset", () => {
		const html = render(PSA_TEMPLATE, {});
		expect(html).toContain("deutlich erhöht");
		expect(html).not.toContain("Normbereich");
	});

	test("selects on a calculated value", () => {
		const html = render(
			`{% calc "score" formula="[a]+[b]" /%}
{% condition "score" %}{% case lt=3 %}niedrig{% /case %}{% case default=true %}hoch{% /case %}{% /condition %}`,
			{ a: 1, b: 1 },
		);
		expect(html).toContain("niedrig");
		expect(html).not.toContain("hoch");
	});

	test("an info on a calc displays the computed value", () => {
		expect(
			render(`{% calc "score" formula="[a]*2" /%}\n{% info "score" type="number" /%}`, { a: 3 }),
		).toContain("6");
	});
});
