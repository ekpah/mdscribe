import { expect, test } from "bun:test";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { resolveCalculatedValues } from "../parse/calculated-values";
import { analyzeMarkdocTemplate } from "../parse/parse-markdoc-to-inputs";
import { DynamicMarkdocRenderer } from "../react";

test("exact showcase validates and renders independent asymmetric condition results", async () => {
	const content = await Bun.file(new URL("./multi-field-showcase.md", import.meta.url)).text();
	const analysis = analyzeMarkdocTemplate(content);
	expect(analysis.diagnostics).toEqual([]);
	expect(
		analysis.inputs.some((input) =>
			input.children.some((child) => child.attributes.primary === "undeclared_demo"),
		),
	).toBe(true);
	const left = renderToStaticMarkup(
		<DynamicMarkdocRenderer
			markdocContent={content}
			variables={{ ivsd_demo: 12, lvpwd_demo: 8 }}
		/>,
	);
	const right = renderToStaticMarkup(
		<DynamicMarkdocRenderer
			markdocContent={content}
			variables={{ ivsd_demo: 8, lvpwd_demo: 12 }}
		/>,
	);
	expect(left).toContain("Erster Fall: IVSd über 11 mm.");
	expect(left).not.toContain("Zweiter Fall: LVPWd über 11 mm.");
	expect(right).not.toContain("Erster Fall: IVSd über 11 mm.");
	expect(right).toContain("Zweiter Fall: LVPWd über 11 mm.");
});

test("categorical and boolean mappings are inherited globally without replacing stored values", () => {
	const source = `{% switch "kind" %}{% case "a" value=2 %}Alpha{% /case %}{% /switch %}{% switch "kind" %}{% case "b" value=7 %}Beta{% /case %}{% /switch %}{% switch "flag" type="boolean" %}{% case "true" value=10 %}Yes{% /case %}{% case "false" value=-1 %}No{% /case %}{% /switch %}{% calc "total" formula="[kind]+[flag]" /%}`;
	const { inputs, diagnostics } = analyzeMarkdocTemplate(source);
	expect(diagnostics).toEqual([]);
	expect(resolveCalculatedValues(inputs, { kind: "b", flag: true })).toMatchObject({
		kind: "b",
		flag: true,
		total: 17,
	});
	expect(resolveCalculatedValues(inputs, { kind: "a", flag: false }).total).toBe(1);
});

test("hidden calculations compute globally, round dependencies, and yield to explicit values", () => {
	const source = `{% switch "mode" %}{% case "shown" %}{% calc "third" formula="1/3" round=2 /%}{% /case %}{% /switch %}{% calc "scaled" formula="[third]*100" /%}`;
	const { inputs } = analyzeMarkdocTemplate(source);
	expect(resolveCalculatedValues(inputs, { mode: "hidden" })).toMatchObject({
		third: 0.33,
		scaled: 33,
	});
	// The caller merges AI suggestions and manual input first; the winning explicit value overrides calc.
	expect(resolveCalculatedValues(inputs, { mode: "hidden", third: 0.456 })).toMatchObject({
		third: 0.46,
		scaled: 46,
	});
});
