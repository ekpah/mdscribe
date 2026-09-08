import { expect, test } from "bun:test";

import Markdoc from "@markdoc/markdoc";

import { renderTipTapHTML } from "../editor";
import { markdocConfig } from "../markdoc-config";

test("cases accept nested tags and rich multiline content", () => {
	const source = `{% switch "outer" %}
{% case "yes" %}
First {% info "value" /%}

{% switch "inner" %}{% case "right" %}Right{% /case %}{% /switch %}
{% /case %}
{% /switch %}`;
	expect(Markdoc.validate(Markdoc.parse(source), markdocConfig)).toEqual([]);
	expect(renderTipTapHTML(source)).toContain('primary="inner"');
});

test("editor renders soft and hard line breaks without changing standard Markdoc rendering", () => {
	for (const source of ["first\nsecond", "first  \nsecond", "first\\\nsecond"]) {
		expect(renderTipTapHTML(source)).toBe("<article><p>first<br>second</p></article>");
	}
	expect(
		Markdoc.renderers.html(Markdoc.transform(Markdoc.parse("first\nsecond"), markdocConfig)),
	).toBe("<article><p>first second</p></article>");
});

test("empty paragraph and boundary-break padding does not become editor text", () => {
	expect(renderTipTapHTML("&nbsp;\n\nfirst  \n&nbsp;  \nlast  \n&nbsp;\n\n&nbsp;")).toBe(
		"<article><p></p><p>first<br><br>last<br></p><p></p></article>",
	);
});

test("code newlines and non-breaking spaces inside text remain literal", () => {
	expect(renderTipTapHTML("```\nfirst\nsecond\n```")).toBe(
		"<article><pre>first\nsecond\n</pre></article>",
	);
	expect(renderTipTapHTML("first&nbsp;second")).toBe("<article><p>first second</p></article>");
});

test("calc and legacy score schemas accept and render shared description/source attributes", () => {
	for (const tag of ["calc", "score"]) {
		const source = `{% ${tag} primary="result" formula="1" description="Result description" source="Observation.value" %}{% /${tag} %}`;
		expect(Markdoc.validate(Markdoc.parse(source), markdocConfig)).toEqual([]);
		expect(renderTipTapHTML(source)).toContain('description="Result description"');
		expect(renderTipTapHTML(source)).toContain('source="Observation.value"');
	}
});
