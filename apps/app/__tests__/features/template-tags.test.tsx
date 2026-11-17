import { describe, expect, test } from "bun:test";

import { renderTipTapHTML } from "markdoc-md/editor";
import { analyzeMarkdocTemplate, validateMarkdocTemplate } from "markdoc-md/parse";
import { renderMarkdocAsReact } from "markdoc-md/react";
import { renderToStaticMarkup } from "react-dom/server";

import { templateTagComponents } from "../../features/template-tags/components";
import { appMarkdocConfig, validateAppTemplate } from "../../features/template-tags/config";
import { getTemplateSections, splitSectionOutput } from "../../features/template-tags/sections";

const LETTER = `{% section id="diagnosen" title="Diagnosen" %}
{% ai %}Hauptdiagnose{% /ai %}
{% /section %}

{% section id="anamnese" %}
Nikotin: {% switch "Raucher" type="boolean" %}{% case "true" %}{% info "Packungsjahre" type="number" unit="py" /%} py{% /case %}{% case "false" %}Nichtraucher{% /case %}{% /switch %}

- Punkt
{% /section %}`;

const INLINE = 'Verlauf: {% ai %}kurz (extern) zusammenfassen{% /ai %} {% info "Datum" /%}';
const BLOCK = "{% ai %}\nAbsatz mit Aufnahmegrund.\n{% /ai %}\n\nText";

const ids = (content: string) =>
	validateAppTemplate(content).flatMap((d) => (d.code === "markdoc-schema" ? [d.id] : [d.code]));

const renderTemplate = (source: string) =>
	renderToStaticMarkup(
		renderMarkdocAsReact(source, {
			components: templateTagComponents,
			config: appMarkdocConfig,
			layout: "template",
		}),
	);

describe("app template tags", () => {
	test("markdoc-md alone does not know them; the app config accepts them", () => {
		expect(validateMarkdocTemplate(INLINE).map((d) => d.code)).toContain("markdoc-schema");
		expect(validateAppTemplate(INLINE)).toEqual([]);
		expect(validateAppTemplate(BLOCK)).toEqual([]);
		expect(validateAppTemplate(LETTER)).toEqual([]);
	});

	test("variables inside sections and instructions are found like any other", () => {
		const names = analyzeMarkdocTemplate(LETTER, appMarkdocConfig).variables.map((v) => v.name);
		expect(names).toEqual(["Raucher", "Packungsjahre"]);
	});

	test("a section needs a well-formed id, sits at the top level and owns all content", () => {
		expect(ids("{% section %}\nText\n{% /section %}")).toContain("attribute-missing-required");
		expect(ids('{% section id="a b" %}\nText\n{% /section %}')).toEqual(["section-id-invalid"]);
		expect(ids('Text {% section id="a" %}B{% /section %}')).toContain("tag-placement-invalid");
		expect(
			ids('{% section id="a" %}\n{% section id="b" %}\nText\n{% /section %}\n{% /section %}'),
		).toEqual(["section-nested"]);
		expect(
			ids('{% section id="a" %}\nA\n{% /section %}\n\n{% section id="a" %}\nB\n{% /section %}'),
		).toEqual(["section-duplicate-id"]);
		expect(ids('Vorab\n\n{% section id="a" %}\nA\n{% /section %}')).toEqual([
			"section-content-outside",
		]);
		// Empty lines, such as the editor's trailing &nbsp; paragraph, are not content.
		expect(ids('{% section id="a" %}\nA\n{% /section %}\n\n&nbsp;\n\n&nbsp;\n\n')).toEqual([]);
	});

	test("instructions render muted and marked for copying, inline and as a block", () => {
		expect(renderTemplate(INLINE)).toContain(
			'<span data-markdoc-ai="" style="color:#888;font-style:italic">kurz (extern) zusammenfassen</span>',
		);
		expect(renderTemplate(BLOCK)).toMatch(
			/<div data-markdoc-ai="" style="[^"]*"><div data-template-line="" style="margin:0">Absatz mit Aufnahmegrund\.<\/div><\/div>/u,
		);
	});

	test("a section renders its title as a bold first line, falling back to the id", () => {
		const html = renderTemplate(LETTER);
		// Copied rich text keeps inline styles, not classes: the title stays a bold line.
		expect(html).toContain('data-section-id="diagnosen"');
		expect(html).toContain('data-template-line="" style="font-weight:600">Diagnosen</div>');
		expect(html).toContain('style="font-weight:600">anamnese</div>');
	});

	test("the editor receives an element per tag", () => {
		const html = renderTipTapHTML(`${INLINE}\n\n${LETTER}`, { config: appMarkdocConfig });
		expect(html).toContain("<Ai>kurz (extern) zusammenfassen</Ai>");
		expect(html).toContain('<Section id="diagnosen" title="Diagnosen">');
	});
});

describe("getTemplateSections", () => {
	test("returns each section's id and title, reads #id, and nothing for fewer than two sections", () => {
		expect(getTemplateSections(LETTER)).toEqual([
			{ id: "diagnosen", title: "Diagnosen" },
			{ id: "anamnese", title: "anamnese" },
		]);
		// A sole section is no section: a document has two or more of them or none.
		expect(getTemplateSections("{% section #befunde %}\nB\n{% /section %}")).toEqual([]);
		expect(getTemplateSections("Kein Abschnitt")).toEqual([]);
	});
});

describe("splitSectionOutput", () => {
	test("reads a streaming response, including the unfinished last section", () => {
		const partial =
			'Vorab ignoriert\n{% section id="diagnosen" %}\nPneumonie rechts\n{% /section %}\n\n{% section id="epikrise" %}\nDie Aufnahme erf';
		expect(splitSectionOutput(partial)).toEqual({
			diagnosen: "Pneumonie rechts",
			epikrise: "Die Aufnahme erf",
		});
		expect(splitSectionOutput('{% section id="a" %}Text{% /sec')).toEqual({ a: "Text" });
		expect(splitSectionOutput('<section id="a">Text</section>')).toEqual({});
	});
});
