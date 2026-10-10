import { describe, expect, test } from "bun:test";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { resolveCalculatedValues } from "../parse/calculated-values";
import { renameFormulaVariable } from "../parse/formula";
import { analyzeMarkdocTemplate } from "../parse/parse-markdoc-to-inputs";
import { isBranchVisible } from "../parse/switch-selection";
import { DynamicMarkdocRenderer } from "../react";

describe("condition input extraction", () => {
	test("one-member arrays keep aligned predicates and group metadata stays local", () => {
		const { inputs, diagnostics } = analyzeMarkdocTemplate(
			`{% condition ["x"] unit="group" description="group only" %}{% case gt=[4] %}{% info "note" /%}{% /case %}{% /condition %}`,
		);
		expect(diagnostics).toEqual([]);
		expect(inputs[0]?.attributes).toEqual({ primary: "x", type: "number" });
		expect(isBranchVisible(inputs[1]?.visibility, { x: 5 })).toBe(true);
		expect(isBranchVisible(inputs[1]?.visibility, { x: 4 })).toBe(false);
	});
	test("flattens scalar and vector fields and retains descendant visibility", () => {
		const { inputs } = analyzeMarkdocTemplate(`
{% condition "single" %}{% case gte=2 %}{% info "scalarChild" type="number" /%}{% /case %}{% /condition %}
{% condition ["left", "right"] %}
{% case gt=[1, null] lte=[null, 4] %}{% info "matched" type="number" /%}{% /case %}
{% case default=true %}{% info "fallback" type="number" /%}{% /case %}
{% /condition %}`);
		expect(
			inputs.filter((input) => ["single", "left", "right"].includes(input.attributes.primary)),
		).toHaveLength(3);
		const matched = inputs.find((input) => input.attributes.primary === "matched")!;
		const fallback = inputs.find((input) => input.attributes.primary === "fallback")!;
		expect(isBranchVisible(matched.visibility, { left: 2, right: 4 })).toBe(true);
		expect(isBranchVisible(matched.visibility, { left: 2 })).toBe(false);
		expect(isBranchVisible(fallback.visibility, { left: 0, right: 9 })).toBe(true);
	});
});

describe("global calculation runtime", () => {
	test("explicit nested switch controls also offer the full global option union", () => {
		const { inputs, diagnostics } = analyzeMarkdocTemplate(
			`{% switch "choice" %}{% case "a" value=2 %}A{% /case %}{% /switch %}{% calc "total" formula="[choice]" %}{% switch "choice" %}{% case "b" value=7 %}B{% /case %}{% /switch %}{% /calc %}`,
		);
		expect(diagnostics).toEqual([]);
		const calc = inputs.find((input) => input.name === "Calc")!;
		expect(calc.children[0]?.children.map((child) => child.attributes.primary).sort()).toEqual([
			"a",
			"b",
		]);
		expect(resolveCalculatedValues(inputs, { choice: "a" }).total).toBe(2);
	});
	test("merges options and mappings while defaults and content stay occurrence-local", () => {
		const first = `{% switch "choice" %}{% case "a" %}FIRST{% info "aNote" /%}{% /case %}{% case default=true %}FIRST_FALLBACK{% info "fallbackNote" /%}{% /case %}{% /switch %}`;
		const second = `{% switch "choice" %}{% case "a" value=2 %}SECOND_A{% /case %}{% case "b" value=7 %}SECOND_B{% /case %}{% /switch %}`;
		for (const content of [first + second, second + first]) {
			const source = `${content}{% calc "result" formula="[choice]*3" /%}{% calc "otherResult" formula="[choice]*5" /%}`;
			const { inputs, diagnostics } = analyzeMarkdocTemplate(source);
			expect(diagnostics).toEqual([]);
			expect(inputs.filter((input) => input.name === "Switch")).toHaveLength(1);
			const calc = inputs.find((input) => input.name === "Calc")!;
			expect(calc.children[0]?.name).toBe("Switch");
			expect(calc.children[0]?.children.map((child) => child.attributes.primary).sort()).toEqual([
				"a",
				"b",
			]);
			expect(resolveCalculatedValues(inputs, { choice: "a" }).result).toBe(6);
			expect(resolveCalculatedValues(inputs, { choice: "b" }).result).toBe(21);
			const html = renderToStaticMarkup(
				<DynamicMarkdocRenderer markdocContent={source} variables={{ choice: "b" }} />,
			);
			expect(html).toContain("FIRST_FALLBACK");
			expect(html).toContain("SECOND_B");
			expect(html).not.toContain("SECOND_A");
			expect(html).toContain(">35<");
		}
	});
	test("publishes hidden calculations globally and rounds before dependent calculations", () => {
		const { inputs } = analyzeMarkdocTemplate(`
{% switch "mode" %}{% case "visible" %}{% calc "hidden" formula="[raw] / 3" round=2 /%}{% /case %}{% /switch %}
{% calc "result" formula="[hidden] * 100" /%}`);
		expect(resolveCalculatedValues(inputs, { mode: "other", raw: 1 })).toMatchObject({
			hidden: 0.33,
			result: 33,
		});
		expect(resolveCalculatedValues(inputs, { mode: "other", raw: 1, hidden: 0.336 })).toMatchObject(
			{
				hidden: 0.34,
				result: 34,
			},
		);
	});

	test("waits for every input before calculating and shows a placeholder until then", () => {
		const source = `BMI {% calc "bmi" formula="[gewicht] / ([groesse] / 100)^2" round=1 /%} ({% info "bmi" /%}), doubled {% calc "double" formula="[bmi] * 2" /%}, checked {% calc "flag" formula="[on] + 1" /%}
{% switch "on" type="boolean" %}{% case "true" %}On{% /case %}{% case "false" %}Off{% /case %}{% /switch %}
{% condition "bmi" %}{% case lt=18.5 %}UNDERWEIGHT{% /case %}{% case default=true %}FALLBACK{% /case %}{% /condition %}`;
		const { inputs } = analyzeMarkdocTemplate(source);
		for (const values of [
			{},
			{ gewicht: 80 },
			{ gewicht: 80, groesse: "" },
			{ gewicht: 80, groesse: 0 },
		]) {
			const resolved = resolveCalculatedValues(inputs, values);
			expect(resolved.bmi).toBeUndefined();
			expect(resolved.double).toBeUndefined();
			const html = renderToStaticMarkup(
				<DynamicMarkdocRenderer markdocContent={source} variables={values} />,
			);
			expect(html.match(/>…</gu)).toHaveLength(3);
			expect(html).not.toContain("NaN");
			expect(html).not.toContain("UNDERWEIGHT");
			expect(html).toContain("FALLBACK");
		}
		// An unchecked checkbox is false, not missing.
		expect(resolveCalculatedValues(inputs, {}).flag).toBe(1);
		expect(resolveCalculatedValues(inputs, { gewicht: 80, groesse: 180 })).toMatchObject({
			bmi: 24.7,
			double: 49.4,
		});
	});

	test("uses categorical mappings declared outside a calc without changing stored values", () => {
		const { inputs } = analyzeMarkdocTemplate(`
{% switch "choice" %}{% case "low" value=2 %}Low{% /case %}{% case "high" value=7 %}High{% /case %}{% /switch %}
{% switch "enabled" type="boolean" %}{% case "true" value=4 %}On{% /case %}{% case "false" %}Off{% /case %}{% /switch %}
{% calc "result" formula="[choice] + [enabled]" /%}`);
		expect(resolveCalculatedValues(inputs, { choice: "high", enabled: true })).toMatchObject({
			choice: "high",
			enabled: true,
			result: 11,
		});
		expect(resolveCalculatedValues(inputs, { choice: "low", enabled: false }).result).toBe(2);
	});

	test("rounds explicit numeric strings like numbers before dependents use them", () => {
		const { inputs } = analyzeMarkdocTemplate(
			`{% calc "s" formula="[a]" /%}{% calc "t" formula="[s]*100" round=0 /%}`,
		);
		expect(resolveCalculatedValues(inputs, { a: 1, s: "1.006" })).toMatchObject({
			s: 1.01,
			t: 101,
		});
	});

	test("a keyless case never matches in the renderer or the input panel", () => {
		const source = `{% switch "s" %}{% case %}keyless {% info "k" /%}{% /case %}{% case "a" %}A{% /case %}{% /switch %}`;
		const { inputs } = analyzeMarkdocTemplate(source);
		const keyless = inputs[0]?.children[0];
		for (const values of [{}, { s: "" }]) {
			expect(isBranchVisible(keyless?.visibility, values)).toBe(false);
			expect(
				renderToStaticMarkup(<DynamicMarkdocRenderer markdocContent={source} variables={values} />),
			).not.toContain("keyless");
		}
	});

	test("an untyped true/false switch selects with checkbox booleans", () => {
		const html = renderToStaticMarkup(
			<DynamicMarkdocRenderer
				markdocContent={`{% switch "s" %}{% case "true" %}YES{% /case %}{% case "false" %}NO{% /case %}{% /switch %}`}
				variables={{ s: true }}
			/>,
		);
		expect(html).toContain("YES");
		const { inputs } = analyzeMarkdocTemplate(
			`{% switch "s" %}{% case "true" value=5 %}Y{% /case %}{% case "false" value=0 %}N{% /case %}{% /switch %}{% calc "r" formula="[s]*2" /%}`,
		);
		expect(resolveCalculatedValues(inputs, { s: true }).r).toBe(10);
	});

	test("rounds halves away from zero despite binary fractions", () => {
		const { inputs } = analyzeMarkdocTemplate(`{% calc "r" formula="[a]" round=1 /%}`);
		expect(resolveCalculatedValues(inputs, { a: 5.55 }).r).toBe(5.6);
		expect(resolveCalculatedValues(inputs, { a: -5.55 }).r).toBe(-5.6);
		expect(resolveCalculatedValues(inputs, { a: 1.005 }).r).toBe(1);
	});

	test("formula constants are not inputs", () => {
		const { inputs, diagnostics } = analyzeMarkdocTemplate(
			`{% calc "area" formula="PI*[r]^2" /%} {% info "r" type="number" /%}`,
		);
		expect(diagnostics).toEqual([]);
		expect(inputs.map((input) => input.attributes.primary)).toEqual(["area", "r"]);
		expect(inputs[0]?.children.map((child) => child.attributes.primary)).toEqual(["r"]);
		expect(resolveCalculatedValues(inputs, { r: 2 }).area).toBe(12.57);
	});

	test("supports formula-only calculations", () => {
		const { inputs } = analyzeMarkdocTemplate(`{% calc "result" formula="2 + 3" /%}`);
		expect(resolveCalculatedValues(inputs, {}).result).toBe(5);
	});
});

describe("formula variable rename", () => {
	for (const [formula, from, to, expected] of [
		["[a] + [ab] * 2", "a", "b", "[b] + [ab] * 2"],
		["a + ab * a", "a", "z", "z + ab * z"],
		["[Gewicht] / ([Groesse] / 100) ^ 2", "Groesse", "Größe", "[Gewicht] / ([Größe] / 100) ^ 2"],
		["x + y", "x", "Körper größe", "[Körper größe] + y"],
		["[a.b] + b", "b", "c", "[a.b] + c"],
		["sin(a) + a", "a", "w", "sin(w) + w"],
		["[c] + d", "x", "y", "[c] + d"],
	] as const) {
		test(`${formula}: ${from} -> ${to}`, () => {
			expect(renameFormulaVariable(formula, from, to)).toBe(expected);
		});
	}
});
