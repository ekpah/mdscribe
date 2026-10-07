import { expect, test } from "bun:test";

import { renderToStaticMarkup } from "react-dom/server";

import renderMarkdocAsReact from "../render/utils/render-markdoc-as-react";

const render = (source: string) =>
	renderToStaticMarkup(renderMarkdocAsReact(source, { layout: "template" }));

test("template soft breaks are real breaks, while adjacent paragraphs are single line blocks", () => {
	expect(render("Alpha\nBeta\n\nGamma")).toContain(
		'<div data-template-line="" style="margin:0">Alpha<br/>Beta</div><div data-template-line="" style="margin:0">Gamma</div>',
	);
	expect(renderToStaticMarkup(renderMarkdocAsReact("Alpha\nBeta"))).toBe(
		"<article><p>Alpha Beta</p></article>",
	);
});

test("explicit blank lines and consecutive hard breaks survive template output", () => {
	expect(render("Alpha  \n&nbsp;  \nBeta\n\n&nbsp;\n\nGamma")).toContain(
		'Alpha<br/> <br/>Beta</div><div data-template-line="" style="margin:0"> </div><div data-template-line="" style="margin:0">Gamma',
	);
});

test("headings and ordered/loose lists carry portable typography without paragraph nodes", () => {
	const html = render("## Verlauf\n**Befund:**\nZeile\n\n3. Erstens\n\n4. Zweitens");
	expect(html).toContain(
		'<h2 style="font-size:20px;font-weight:700;line-height:1.25;margin:12px 0 6px">Verlauf</h2>',
	);
	expect(html).toContain('start="3"');
	expect(html).toContain("Befund:</strong><br/>Zeile");
	expect(html).not.toContain("<p");
});

test("details gaps are structural empty lines, and adjacent sections stay adjacent", () => {
	const html = render(
		'Intro\n{% details summary="A" %}\nInnen\n{% /details %}\n{% details summary="B" %}\nWeiter\n{% /details %}\n\nOutro',
	);
	expect(html).toContain('Intro</div><details data-markdoc-details="" style="margin:0">');
	expect(html).toContain('</details><details data-markdoc-details="" style="margin:0">');
	expect(html).toContain(
		'</details><div data-template-line="" style="margin:0"> </div><div data-template-line="" style="margin:0">Outro',
	);
});

test("template layout preserves explicit custom Details components", () => {
	const html = renderToStaticMarkup(
		renderMarkdocAsReact("{% details %}\nBody\n{% /details %}", {
			components: { Details: () => <aside>Custom details</aside> },
			layout: "template",
		}),
	);
	expect(html).toContain("<aside>Custom details</aside>");
	expect(html).not.toContain("<details");
});

test("literal code and nonbreaking spaces inside text are not rewritten", () => {
	const html = render("Alpha&nbsp;Beta\n\n```\nA:\nB\n```");
	expect(html).toContain("Alpha Beta");
	expect(html).toContain("<pre>A:\nB\n</pre>");
});
