import { describe, expect, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { MarkdocInteractionProvider } from "../render/context/markdoc-interaction-context";
import renderMarkdocAsReact from "../render/utils/render-markdoc-as-react";

const render = (content: string): string =>
	renderToStaticMarkup(
		React.createElement(
			MarkdocInteractionProvider,
			{ value: { areCitationsHighlighted: false, onCitationSelect: () => undefined } },
			renderMarkdocAsReact(content),
		),
	);

describe("tolerant cite rendering", () => {
	test("makes a valid citation keyboard accessible", () => {
		const html = render(`{% cite source="https://example.test" %}valid{% /cite %}`);
		expect(html).toContain('role="button"');
		expect(html).toContain('tabindex="0"');
	});

	test("renders invalid and link-containing citations inertly", () => {
		for (const content of [
			"{% cite %}missing{% /cite %}",
			`{% cite source="https://example.test" %}[link](https://other.test){% /cite %}`,
		]) {
			const html = render(content);
			expect(html).toContain('aria-invalid="true"');
			expect(html).not.toContain('role="button"');
		}
	});

	test("unwraps a block-spanning cite instead of producing nested paragraphs", () => {
		const html = render(
			`{% cite source="https://example.test" %}first\n\nsecond{% /cite %}`,
		);
		expect(html).toBe("<article><p>first</p><p>second</p></article>");
	});
});
