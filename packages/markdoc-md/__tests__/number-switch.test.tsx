import { describe, expect, test } from "bun:test";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
	analyzeMarkdocTemplate,
	buildVariableContracts,
	resolveMatchedCaseIndex,
	toNumericSwitchValue,
	validateMarkdocTemplate,
} from "../index";
import Markdoc from "@markdoc/markdoc";
import { DynamicMarkdocRenderer } from "../react";

const codes = (content: string) =>
	validateMarkdocTemplate(content).map((diagnostic) => diagnostic.code);

const PSA_TEMPLATE = `{% switch "psa" type="number" unit="ng/ml" %}{% case lt=4 %}PSA im Normbereich.{% /case %}{% case gte=4 lt=10 %}PSA in der Grauzone.{% /case %}{% case default=true %}PSA deutlich erhöht.{% /case %}{% /switch %}`;

describe("case condition evaluation", () => {
	test("first matching case in document order wins", () => {
		const conditions = [{ lt: 4 }, { gte: 4, lt: 10 }, { default: true }];
		expect(resolveMatchedCaseIndex(3.9, conditions)).toBe(0);
		expect(resolveMatchedCaseIndex(4, conditions)).toBe(1);
		expect(resolveMatchedCaseIndex(25, conditions)).toBe(2);
	});

	test("an unset value only matches a default case", () => {
		expect(resolveMatchedCaseIndex(null, [{ lt: 4 }, { gte: 4 }])).toBeNull();
		expect(resolveMatchedCaseIndex(null, [{ lt: 4 }, { default: true }])).toBe(1);
	});

	test("coerces numeric strings including decimal commas", () => {
		expect(toNumericSwitchValue("4,5")).toBe(4.5);
		expect(toNumericSwitchValue("4.5")).toBe(4.5);
		expect(toNumericSwitchValue(true)).toBe(1);
		expect(toNumericSwitchValue("")).toBeNull();
		expect(toNumericSwitchValue("abc")).toBeNull();
	});
});

describe("number switch validation", () => {
	test("accepts a well-formed number switch", () => {
		expect(validateMarkdocTemplate(PSA_TEMPLATE)).toEqual([]);
	});

	test("infers a number switch from condition cases without an explicit type", () => {
		const template = `{% switch "psa" %}{% case lt=4 %}ok{% /case %}{% case default=true %}hoch{% /case %}{% /switch %}`;
		expect(validateMarkdocTemplate(template)).toEqual([]);
		const { contracts } = buildVariableContracts(Markdoc.parse(template));
		expect(contracts.get("psa")?.domain).toBe("number");
	});

	test("requires a condition on every case of a number switch", () => {
		expect(
			codes(`{% switch "psa" type="number" %}{% case "low" %}x{% /case %}{% /switch %}`),
		).toContain("case-condition-invalid");
	});

	test("rejects condition cases on non-number switches", () => {
		const diagnostics = validateMarkdocTemplate(
			`{% switch "gender" type="string" %}{% case lt=4 %}x{% /case %}{% /switch %}`,
		);
		expect(diagnostics).toContainEqual(
			expect.objectContaining({
				code: "case-condition-invalid",
				reason: "requires-number-switch",
			}),
		);
	});

	test("rejects conflicting operators, empty ranges, and mixed primary+condition", () => {
		expect(
			validateMarkdocTemplate(
				`{% switch "x" type="number" %}{% case gt=1 gte=2 %}a{% /case %}{% /switch %}`,
			),
		).toContainEqual(expect.objectContaining({ reason: "conflicting-operators" }));
		expect(
			validateMarkdocTemplate(
				`{% switch "x" type="number" %}{% case gte=10 lt=4 %}a{% /case %}{% /switch %}`,
			),
		).toContainEqual(expect.objectContaining({ reason: "empty-range" }));
		expect(
			validateMarkdocTemplate(
				`{% switch "x" type="number" %}{% case "low" lt=4 %}a{% /case %}{% /switch %}`,
			),
		).toContainEqual(expect.objectContaining({ reason: "primary-and-condition" }));
	});

	test("rejects cases after a default as unreachable", () => {
		expect(
			codes(
				`{% switch "x" type="number" %}{% case default=true %}a{% /case %}{% case lt=4 %}b{% /case %}{% /switch %}`,
			),
		).toContain("case-unreachable");
	});

	test("rejects a case outside any switch", () => {
		expect(codes(`{% case "stray" %}lost{% /case %}`)).toContain("orphan-case");
	});
});

describe("variable coexistence", () => {
	test("info and number switch may share a variable when domains agree", () => {
		const template = `{% info "psa" type="number" unit="ng/ml" /%}\n${PSA_TEMPLATE}`;
		expect(validateMarkdocTemplate(template)).toEqual([]);
		const contract = buildVariableContracts(Markdoc.parse(template)).contracts.get("psa");
		expect(contract?.roles).toEqual({ computed: false, field: true, selector: true });
	});

	test("implicit text info conflicts with a number switch", () => {
		expect(codes(`{% info "psa" /%}\n${PSA_TEMPLATE}`)).toContain("variable-domain-conflict");
	});

	test("calc and number switch may share a variable", () => {
		const template = `{% calc primary="score" formula="[a]+[b]" %}{% info "a" type="number" /%}{% info "b" type="number" /%}{% /calc %}
{% switch "score" type="number" %}{% case lt=2 %}niedrig{% /case %}{% case default=true %}hoch{% /case %}{% /switch %}`;
		expect(validateMarkdocTemplate(template)).toEqual([]);
	});
});

describe("input extraction and deduplication", () => {
	test("info + number switch produce one merged input", () => {
		const template = `{% info "psa" type="number" unit="ng/ml" description="PSA-Wert" /%}\n${PSA_TEMPLATE}`;
		const { inputs, variables } = analyzeMarkdocTemplate(template);
		const psaInputs = inputs.filter((input) => input.attributes.primary === "psa");
		expect(psaInputs).toHaveLength(1);
		const merged = psaInputs[0];
		expect(merged?.name).toBe("Switch");
		expect(merged?.attributes).toMatchObject({
			description: "PSA-Wert",
			type: "number",
			unit: "ng/ml",
		});
		expect(variables.find((variable) => variable.name === "psa")?.domain).toBe("number");
	});

	test("calc + switch drop the switch input and hoist nested inputs", () => {
		const template = `{% calc primary="score" formula="[a]" %}{% info "a" type="number" /%}{% /calc %}
{% switch "score" type="number" %}{% case lt=2 %}niedrig {% info "note" /%}{% /case %}{% case default=true %}hoch{% /case %}{% /switch %}`;
		const { inputs } = analyzeMarkdocTemplate(template);
		expect(inputs.some((input) => input.name === "Switch")).toBe(false);
		expect(
			inputs.some((input) => input.name === "Info" && input.attributes.primary === "note"),
		).toBe(true);
		expect(
			inputs.some((input) => input.name === "Calc" && input.attributes.primary === "score"),
		).toBe(true);
	});

	test("calc + info drop the info input and adopt its unit", () => {
		const template = `{% info "score" type="number" unit="Punkte" /%}
{% calc primary="score" formula="[a]" %}{% info "a" type="number" /%}{% /calc %}`;
		const { inputs } = analyzeMarkdocTemplate(template);
		const scoreInputs = inputs.filter((input) => input.attributes.primary === "score");
		expect(scoreInputs).toHaveLength(1);
		expect(scoreInputs[0]?.name).toBe("Calc");
		expect(scoreInputs[0]?.attributes).toMatchObject({ unit: "Punkte" });
	});

	test("condition cases are extracted with their operators", () => {
		const { inputs } = analyzeMarkdocTemplate(PSA_TEMPLATE);
		const switchInput = inputs.find((input) => input.name === "Switch");
		expect(switchInput?.children.map((child) => child.attributes)).toEqual([
			expect.objectContaining({ lt: 4 }),
			expect.objectContaining({ gte: 4, lt: 10 }),
			expect.objectContaining({ default: true }),
		]);
	});
});

describe("number switch rendering", () => {
	const render = (variables: Record<string, unknown>) =>
		renderToStaticMarkup(
			React.createElement(DynamicMarkdocRenderer, {
				markdocContent: PSA_TEMPLATE,
				variables: variables as Record<string, string | number | boolean>,
			}),
		);

	test("renders only the first matching case", () => {
		expect(render({ psa: 2 })).toContain("Normbereich");
		expect(render({ psa: 2 })).not.toContain("Grauzone");
		expect(render({ psa: "4,5" })).toContain("Grauzone");
		expect(render({ psa: 25 })).toContain("deutlich erhöht");
	});

	test("renders only the default case when the value is unset", () => {
		const html = render({});
		expect(html).toContain("deutlich erhöht");
		expect(html).not.toContain("Normbereich");
	});

	test("switch on a calc selects on the computed value", () => {
		const template = `{% calc primary="score" formula="[a]+[b]" /%}
{% switch "score" type="number" %}{% case lt=3 %}niedrig{% /case %}{% case default=true %}hoch{% /case %}{% /switch %}`;
		const html = renderToStaticMarkup(
			React.createElement(DynamicMarkdocRenderer, {
				markdocContent: template,
				variables: { a: 1, b: 1 },
			}),
		);
		expect(html).toContain("niedrig");
		expect(html).not.toContain("hoch");
	});

	test("info on a calc displays the computed value", () => {
		const template = `{% calc primary="score" formula="[a]*2" /%}\n{% info "score" type="number" /%}`;
		const html = renderToStaticMarkup(
			React.createElement(DynamicMarkdocRenderer, {
				markdocContent: template,
				variables: { a: 3 },
			}),
		);
		expect(html).toContain("6");
	});
});
