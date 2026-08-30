import { describe, expect, test } from "bun:test";

import React from "react";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { htmlToMarkdoc, isHtmlToMarkdocSupported } from "../editor";
import {
	analyzeMarkdocTemplate,
	markdocConfig,
	parseMarkdocToInputs,
	validateMarkdocTemplate,
} from "../index";
import { DynamicMarkdocRenderer, renderMarkdocAsReact } from "../react";

describe("public integration APIs", () => {
	test("extends the schema and React component map without replacing defaults", () => {
		const config = {
			...markdocConfig,
			tags: {
				...markdocConfig.tags,
				badge: {
					attributes: { tone: { type: String } },
					children: ["text"],
					render: "Badge",
				},
			},
		};
		const template = `{% badge tone="calm" %}Custom{% /badge %} {% info "name" /%}`;
		expect(validateMarkdocTemplate(template, config)).toEqual([]);

		const Badge = ({ children }: { children?: ReactNode }) =>
			React.createElement("span", { "data-custom-badge": "true" }, children);
		const html = renderToStaticMarkup(
			renderMarkdocAsReact(template, {
				components: { Badge },
				config,
			}),
		);
		expect(html).toContain('data-custom-badge="true"');
		expect(html).toContain('data-markdoc-input="name"');
	});

	test("renders the client component during SSR without browser globals", () => {
		const html = renderToStaticMarkup(
			React.createElement(DynamicMarkdocRenderer, {
				markdocContent: `{% info "name" /%}`,
				variables: { name: "Ada" },
			}),
		);
		expect(html).toContain("Ada");
	});

	test("prefers an explicit named calc value over its formula", () => {
		const html = renderToStaticMarkup(
			React.createElement(DynamicMarkdocRenderer, {
				markdocContent: `{% calc primary="risk" formula="[age] * 2" /%}`,
				variables: { age: 4, risk: 11 },
			}),
		);
		expect(html).toContain(">11<");
		expect(html).not.toContain(">8<");
	});

	test("configures decimal-place rounding for calc and numeric info tags", () => {
		const html = renderToStaticMarkup(
			React.createElement(DynamicMarkdocRenderer, {
				markdocContent: [
					`{% calc formula="1 / 3" /%}`,
					`{% calc formula="1 / 3" round=4 /%}`,
					`{% calc formula="1 / 3" round=false /%}`,
					`{% info "measurement" type="number" round=3 /%}`,
				].join(" "),
				variables: { measurement: 1.23456 },
			}),
		);

		expect(html).toContain(">0.33<");
		expect(html).toContain(">0.3333<");
		expect(html).toContain(">0.3333333333333333<");
		expect(html).toContain(">1.235<");
	});

	test("validates round as false or a supported number of decimal places", () => {
		expect(validateMarkdocTemplate(`{% calc formula="1 / 3" round=4 /%}`)).toEqual([]);
		expect(validateMarkdocTemplate(`{% info "value" type="number" round=false /%}`)).toEqual([]);

		for (const round of ["true", "-1", "1.5", "101"]) {
			expect(
				validateMarkdocTemplate(`{% info "value" type="number" round=${round} /%}`),
			).toContainEqual(expect.objectContaining({ id: "round-value-invalid" }));
		}
	});

	test("fails explicitly when the browser-only HTML converter is unavailable", () => {
		expect(isHtmlToMarkdocSupported()).toBe(false);
		expect(() => htmlToMarkdoc("<p>hello</p>")).toThrow("htmlToMarkdoc requires a DOM environment");
	});

	test("reports malformed calc formulas through validation and analysis", () => {
		const template = `{% calc primary="risk" formula="[age] +" /%}`;
		const diagnostics = validateMarkdocTemplate(template);
		expect(diagnostics).toContainEqual(
			expect.objectContaining({ code: "markdoc-schema", id: "calc-formula-invalid" }),
		);
		expect(analyzeMarkdocTemplate(template).diagnostics).toEqual(diagnostics);
	});

	test("maps the legacy score alias to the canonical calc implementation", () => {
		const calc = `{% calc primary="risk" formula="[age] * 2" /%}`;
		const score = `{% score primary="risk" formula="[age] * 2" /%}`;
		expect(parseMarkdocToInputs(score)).toEqual(parseMarkdocToInputs(calc));
		expect(parseMarkdocToInputs(score)[0]?.name).toBe("Calc");
		expect(renderToStaticMarkup(renderMarkdocAsReact(score))).toBe(
			renderToStaticMarkup(renderMarkdocAsReact(calc)),
		);
	});

	test("renders malformed built-in tag attributes without throwing", () => {
		const template = `{% info /%} {% calc formula=true /%} {% switch %}{% case %}x{% /case %}{% /switch %}`;
		const html = renderToStaticMarkup(renderMarkdocAsReact(template));
		expect(html).toContain("No formula");
		expect(html).toContain("...");
		expect(html).not.toContain("data-markdoc-input");
	});
});
