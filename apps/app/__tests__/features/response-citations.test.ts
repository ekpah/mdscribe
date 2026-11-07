import { describe, expect, test } from "bun:test";

import { parse } from "@markdoc/markdoc";
import { renderToStaticMarkup } from "react-dom/server";

import renderMarkdocAsReact from "../../../../packages/markdoc-md/render/utils/render-markdoc-as-react";
import { addScribeCitations } from "../../features/response-citations/markup";

const source = 'mdscribe://input/a`b"c\\d';
const quote = 'CRP `112` "mg/l".\\\nNa 140.';
const tag = (body: string) =>
	`{% cite citations=[{source: ${JSON.stringify(source)}, quote: ${JSON.stringify(quote)}}] %}${body}{% /cite %}`;

describe("AIScribe presentation code normalization", () => {
	test.each([
		["Before `CRP 112` after.", "Before CRP 112 after."],
		["```text\nCRP 112\n```\nAfter.", "\nCRP 112\n\nAfter."],
		["~~~text\nCRP 112\n~~~", "\nCRP 112\n"],
		["```text\nCRP 112", "\nCRP 112"],
		["~~~text\nCRP 112\n~~", "\nCRP 112\n"],
		["`", ""],
		["``", ""],
		["```med", ""],
		["`CRP 112", "CRP 112"],
		["    CRP 112\n    Na 140", "CRP 112\nNa 140"],
		["\tCRP 112\n\tNa 140", "CRP 112\nNa 140"],
		["```CRP 112```", "CRP 112"],
		["``a`b``", "a\\`b"],
		[
			"# Befund\n**CRP** 112 mg/l.\n\n- Alpha\n    - Beta\n\n> Na 140",
			"# Befund\n**CRP** 112 mg/l.\n\n- Alpha\n    - Beta\n\n> Na 140",
		],
		["Text with \\`literal\\` ticks and 3.5 mg/l.", "Text with \\`literal\\` ticks and 3.5 mg/l."],
	])("normalizes without citations: %j", (draft, expected) => {
		expect(addScribeCitations(draft, [])).toBe(expected);
	});

	test("original asymmetric offsets survive before, inside and after code on the same line", () => {
		const draft = "A. `CRP 112; Na 140.` Afterwards normal.";
		const facts = ["A.", "CRP 112", "Na 140.", "Afterwards normal."];
		const citations = facts.map((fact) => ({
			citations: [{ quote, source }],
			end: draft.indexOf(fact) + fact.length,
			start: draft.indexOf(fact),
		}));
		expect(addScribeCitations(draft, citations)).toBe(
			`${tag("A.")} ${tag("CRP 112")}; ${tag("Na 140.")} ${tag("Afterwards normal.")}`,
		);
	});

	test("ranges may include delimiters, indentation and fences; attributes stay opaque", () => {
		for (const draft of ["`CRP 112`", "```text\nCRP 112\n```", "    CRP 112"]) {
			const result = addScribeCitations(draft, [
				{ citations: [{ quote, source }], end: draft.length, start: 0 },
			]);
			expect(result).toBe(tag(addScribeCitations(draft, [])));
			const cite = [...parse(result).walk()].find((node) => node.tag === "cite");
			expect(cite?.attributes.citations).toEqual([{ quote, source }]);
		}
	});

	test.each([
		"`CRP 112; Na 140.`",
		"```text\nCRP 112; Na 140.\n```",
		"~~~text\nCRP 112; Na 140.\n~~",
		"    CRP 112; Na 140.",
		"        CRP 112; Na 140.",
		"`CRP 112; Na 140.",
	])("actual renderer keeps both marks and no raw tags: %j", (draft) => {
		const result = addScribeCitations(
			draft,
			["CRP 112", "Na 140."].map((fact) => ({
				citations: [{ quote, source }],
				end: draft.indexOf(fact) + fact.length,
				start: draft.indexOf(fact),
			})),
		);
		const html = renderToStaticMarkup(renderMarkdocAsReact(result, { layout: "template" }));
		expect(html.match(/<mark\b/gu)).toHaveLength(2);
		expect(html).toContain(">CRP 112</mark>");
		expect(html).toContain(">Na 140.</mark>");
		expect(html).not.toMatch(/<pre\b|<code\b|\{%/u);
	});

	test("every streamed prefix preserves available clinical content and original fact offsets", () => {
		const draft = "```text\nCRP 112 mg/l.\n```\nAfter.";
		const start = draft.indexOf("CRP");
		const end = start + "CRP 112 mg/l.".length;
		for (let length = 0; length <= draft.length; length += 1) {
			const prefix = draft.slice(0, length);
			const result = addScribeCitations(
				prefix,
				length >= end ? [{ citations: [{ quote, source }], end, start }] : [],
			);
			expect(result.includes("```text")).toBe(false);
			if (length >= end) {
				expect(result).toContain(tag("CRP 112 mg/l."));
			}
		}
	});
});
