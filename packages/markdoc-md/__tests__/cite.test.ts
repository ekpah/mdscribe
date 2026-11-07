import { describe, expect, test } from "bun:test";

import Markdoc from "@markdoc/markdoc";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { readCiteCitations } from "../citations/cite-attributes";
import { validateMarkdocTemplate } from "../parse/validate-markdoc-template";
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

	test("a citations list and the older single form are both selectable marks", () => {
		const list = `{% cite citations=[{source: "mdscribe://input/notes", quote: " K 3,4 "}, {source: "mdscribe://file/lab"}] %}K{% /cite %}`;
		for (const content of [
			list,
			`{% cite source="mdscribe://input/notes" quote="K 3,4" %}K{% /cite %}`,
		]) {
			expect(render(content)).toContain('role="button"');
			expect(validateMarkdocTemplate(content)).toEqual([]);
		}
		// What the mark hands to onCitationSelect: every excerpt, in order, trimmed.
		const [cite] = [...Markdoc.parse(list).walk()].filter((node) => node.type === "tag");
		expect(readCiteCitations(cite?.attributes ?? {}).citations).toEqual([
			{ quote: "K 3,4", source: "mdscribe://input/notes" },
			{ quote: undefined, source: "mdscribe://file/lab" },
		]);
	});

	test("one invalid entry, both forms, or no source make the mark inert", () => {
		for (const content of [
			`{% cite citations=[{source: "mdscribe://input/notes"}, {source: "javascript:alert(1)"}] %}K{% /cite %}`,
			`{% cite citations=[{source: "mdscribe://file/lab", quote: "${"x".repeat(4001)}"}] %}K{% /cite %}`,
			`{% cite citations=[] %}K{% /cite %}`,
			`{% cite source="mdscribe://input/notes" citations=[{source: "mdscribe://file/lab"}] %}K{% /cite %}`,
			`{% cite quote="K 3,4" %}K{% /cite %}`,
		]) {
			const html = render(content);
			expect(html).toContain('aria-invalid="true"');
			expect(html).not.toContain('role="button"');
			expect(validateMarkdocTemplate(content).length).toBeGreaterThan(0);
		}
	});

	test("unwraps a block-spanning cite instead of producing nested paragraphs", () => {
		const html = render(`{% cite source="https://example.test" %}first\n\nsecond{% /cite %}`);
		expect(html).toBe("<article><p>first</p><p>second</p></article>");
	});
});
