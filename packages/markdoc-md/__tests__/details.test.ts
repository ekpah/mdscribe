import { describe, expect, test } from "bun:test";

import Markdoc from "@markdoc/markdoc";
import { renderToStaticMarkup } from "react-dom/server";

import { markdocConfig } from "../config";
import { renderTipTapHTML } from "../editor";
import { analyzeMarkdocTemplate, validateMarkdocTemplate } from "../index";
import { DEFAULT_DETAILS_SUMMARY } from "../markdoc-config/tags/helpers/config";
import renderMarkdocAsReact from "../render/utils/render-markdoc-as-react";

const render = (source: string): string => renderToStaticMarkup(renderMarkdocAsReact(source));

describe("details tag", () => {
	test("accepts an optional summary and a boolean open attribute", () => {
		expect(
			validateMarkdocTemplate('{% details summary="Laborwerte" open=true %}\nText\n{% /details %}'),
		).toEqual([]);
		expect(validateMarkdocTemplate("{% details %}\nText\n{% /details %}")).toEqual([]);
	});

	test("reports a non-boolean open attribute", () => {
		const [diagnostic] = validateMarkdocTemplate(
			'{% details summary="A" open="vielleicht" %}\nText\n{% /details %}',
		);
		expect(diagnostic).toMatchObject({
			code: "markdoc-schema",
			id: "attribute-type-invalid",
			severity: "error",
		});
	});

	test("requires the block form, because the inline form nests in a paragraph", () => {
		const [inlineDiagnostic] = validateMarkdocTemplate(
			'Text {% details summary="A" %}B{% /details %} Text',
		);
		expect(inlineDiagnostic).toMatchObject({
			code: "markdoc-schema",
			id: "tag-placement-invalid",
			severity: "error",
		});
		expect(
			Markdoc.renderers.html(
				Markdoc.transform(Markdoc.parse('{% details summary="A" %}B{% /details %}'), markdocConfig),
			),
		).toContain("<p><Details");
	});

	test("renders native details/summary without a wrapper box", () => {
		// React escapes the `&` of the arbitrary Tailwind variants in the class
		// attribute; the DOM value is `my-[1.25em] [&_p]:my-0 …`.
		expect(render('{% details summary="Laborwerte" %}\n**CRP** 12 mg/l\n{% /details %}')).toBe(
			'<article><details class="my-[1.25em] [&amp;_p]:my-0 [&amp;_summary+*]:mt-0 [&amp;&gt;:last-child]:mb-0" data-markdoc-details=""><summary class="cursor-pointer">Laborwerte</summary><p><strong>CRP</strong> 12 mg/l</p></details></article>',
		);
	});

	test("falls back to the GitHub label when summary is omitted", () => {
		const html = render("{% details %}Text{% /details %}");
		expect(html).toContain(`<summary class="cursor-pointer">${DEFAULT_DETAILS_SUMMARY}</summary>`);
	});

	test("opens the section by default when open=true and renders nested tags", () => {
		const html = render(
			'{% details summary="Laborwerte" open=true %}Kreatinin {% info "Kreatinin" /%}{% /details %}',
		);
		expect(html).toContain('data-markdoc-details="" open=""');
		expect(html).toContain('data-markdoc-input="Kreatinin"');
	});

	test("renders nested block content and nested sections", () => {
		const html = render(
			'{% details summary="Vorbefunde" %}\nAuswärtig.\n\n- eins\n- zwei\n\n{% details summary="Radiologie" %}\nRöntgen.\n{% /details %}\n{% /details %}',
		);
		expect(html).toContain("<ul><li>eins</li><li>zwei</li></ul>");
		expect(html.match(/<details/g)).toHaveLength(2);
		expect(html).toContain('<summary class="cursor-pointer">Radiologie</summary>');
	});

	test("keeps discovered inputs inside collapsed sections", () => {
		const { diagnostics, variables } = analyzeMarkdocTemplate(
			'{% details summary="Laborwerte" %}\nKreatinin {% info "Kreatinin" type="number" /%}\n{% /details %}',
		);
		expect(diagnostics).toEqual([]);
		expect([...variables].map((variable) => variable.name)).toEqual(["Kreatinin"]);
	});

	test("renders the editor HTML the TipTap node parses", () => {
		expect(
			renderTipTapHTML('{% details summary="Laborwerte" open=true %}\nText\n{% /details %}'),
		).toBe('<article><Details open="true" summary="Laborwerte"><p>Text</p></Details></article>');
		expect(renderTipTapHTML("{% details %}\nText\n{% /details %}")).toBe(
			'<article><Details open="false"><p>Text</p></Details></article>',
		);
	});

	describe("line flow", () => {
		const lineFlow = (source: string) =>
			[...render(source).matchAll(/<details([^>]*)>/g)].map(([, attributes]) => ({
				joinNext: attributes.includes("data-join-next"),
				joinPrevious: attributes.includes("data-join-previous"),
			}));

		test("continues the surrounding lines when no blank line separates them", () => {
			const html = render(
				'**Therapie und Verlauf:**  \n01/24 Erstdiagnose\n{% details summary="02/24 Chemotherapie" %}\nZyklus 1\n{% /details %}\n03/24 Staging',
			);
			expect(html).toContain(
				'class="my-[1.25em] [&amp;_p]:my-0 [&amp;_summary+*]:mt-0 [&amp;&gt;:last-child]:mb-0 mt-0 [:has(+&amp;)]:mb-0 mb-0 [&amp;+*]:mt-0" data-join-next="" data-join-previous=""',
			);
			expect(html).toContain("<p>03/24 Staging</p>");
		});

		test("keeps the paragraph gap where the source has a blank line", () => {
			expect(lineFlow('Intro\n\n{% details summary="A" %}\nText\n{% /details %}\n\nOutro')).toEqual(
				[{ joinNext: false, joinPrevious: false }],
			);
			expect(lineFlow('Intro\n{% details summary="A" %}\nText\n{% /details %}\n\nOutro')).toEqual([
				{ joinNext: false, joinPrevious: true },
			]);
		});

		test("chains consecutive sections and joins only line blocks", () => {
			expect(
				lineFlow(
					'{% details summary="A" %}\na\n{% /details %}\n{% details summary="B" %}\nb\n{% /details %}\n- Liste',
				),
			).toEqual([
				{ joinNext: true, joinPrevious: false },
				{ joinNext: false, joinPrevious: true },
			]);
			expect(lineFlow('# Titel\n{% details summary="A" %}\na\n{% /details %}')).toEqual([
				{ joinNext: false, joinPrevious: false },
			]);
		});

		test("applies inside nested sections", () => {
			expect(
				lineFlow(
					'{% details summary="Außen" %}\nZeile\n{% details summary="Innen" %}\nText\n{% /details %}\n{% /details %}',
				),
			).toEqual([
				{ joinNext: false, joinPrevious: false },
				{ joinNext: false, joinPrevious: true },
			]);
		});

		test("is not an authorable attribute", () => {
			const [diagnostic] = validateMarkdocTemplate(
				"{% details joinPrevious=true %}\nText\n{% /details %}",
			);
			expect(diagnostic).toMatchObject({ code: "markdoc-schema", severity: "error" });
		});

		test("shows blank lines next to sections as empty editor lines", () => {
			expect(
				renderTipTapHTML(
					'Intro\n{% details summary="A" %}\nText\n{% /details %}\n\nOutro\n\n{% details summary="B" %}\nb\n{% /details %}\n\n{% details summary="C" %}\nc\n{% /details %}',
				),
			).toBe(
				'<article><p>Intro</p><Details open="false" summary="A"><p>Text</p></Details><p></p><p>Outro</p><p></p><Details open="false" summary="B"><p>b</p></Details><p></p><Details open="false" summary="C"><p>c</p></Details></article>',
			);
		});
	});
});
