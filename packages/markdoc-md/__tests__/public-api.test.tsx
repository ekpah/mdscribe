import { describe, expect, test } from "bun:test";
import React from "react";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
	analyzeMarkdocTemplate,
	markdocConfig,
	validateMarkdocTemplate,
} from "../index";
import { htmlToMarkdoc, isHtmlToMarkdocSupported } from "../editor";
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

	test("fails explicitly when the browser-only HTML converter is unavailable", () => {
		expect(isHtmlToMarkdocSupported()).toBe(false);
		expect(() => htmlToMarkdoc("<p>hello</p>")).toThrow(
			"htmlToMarkdoc requires a DOM environment",
		);
	});

	test("reports malformed score formulas through validation and analysis", () => {
		const template = `{% score primary="risk" formula="[age] +" /%}`;
		const diagnostics = validateMarkdocTemplate(template);
		expect(diagnostics).toContainEqual(
			expect.objectContaining({ code: "markdoc-schema", id: "score-formula-invalid" }),
		);
		expect(analyzeMarkdocTemplate(template).diagnostics).toEqual(diagnostics);
	});

	test("renders malformed built-in tag attributes without throwing", () => {
		const template = `{% info /%} {% score formula=true /%} {% switch %}{% case %}x{% /case %}{% /switch %}`;
		const html = renderToStaticMarkup(renderMarkdocAsReact(template));
		expect(html).toContain("No formula");
		expect(html).toContain("...");
		expect(html).not.toContain("data-markdoc-input");
	});
});
