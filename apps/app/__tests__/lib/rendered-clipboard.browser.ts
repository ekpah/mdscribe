// Browser regression: bun build __tests__/lib/rendered-clipboard.browser.ts --target browser --format=iife --outfile /tmp/rendered-clipboard-test.js
// agent-browser eval --stdin < /tmp/rendered-clipboard-test.js
import { renderToStaticMarkup } from "react-dom/server";

import renderMarkdocAsReact from "../../../../packages/markdoc-md/render/utils/render-markdoc-as-react";
import { addScribeCitations } from "../../features/response-citations/markup";
import { getRenderedClipboardContent } from "../../lib/rendered-clipboard";

const equal = (actual: unknown, expected: unknown) => {
	if (actual !== expected) {
		throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
	}
};

const fixtures = [
	{ source: "**Befund:**\nAlpha\nBeta\n\nGamma", text: "Befund:\nAlpha\nBeta\nGamma" },
	{ source: "Alpha  \n&nbsp;  \nBeta\n\n&nbsp;\n\nGamma", text: "Alpha\n\nBeta\n\nGamma" },
	{
		source: "## Diagnosen\n3. Erstens\n\n4. Zweitens\n\n- Drittens",
		text: "Diagnosen\n3. Erstens\n4. Zweitens\n- Drittens",
	},
	{
		source:
			'Vorher\n{% details summary="A" %}\nInnen\n{% details summary="B" %}\nTief\n{% /details %}\n{% /details %}\n\nNachher',
		text: "Vorher\nA\nInnen\nB\nTief\n\nNachher",
	},
];

for (const fixture of fixtures) {
	const element = document.createElement("div");
	element.innerHTML = renderToStaticMarkup(
		renderMarkdocAsReact(fixture.source, { layout: "template" }),
	);
	document.body.append(element);
	try {
		const before = element.innerHTML;
		const { html, text } = getRenderedClipboardContent(element);
		equal(text, fixture.text);
		equal(html, before);
		equal(element.innerHTML, before);
		equal(html.includes("<p"), false);
		// Paste into a document with no app styles: line structure and typography
		// must survive even without Tailwind/prose rules.
		const frame = document.createElement("iframe");
		document.body.append(frame);
		try {
			const frameDocument = frame.contentDocument;
			const frameWindow = frame.contentWindow;
			if (!frameDocument || !frameWindow) {
				throw new Error("Paste frame did not initialize");
			}
			const { body } = frameDocument;
			body.innerHTML = html;
			const article = body.querySelector("article");
			if (!article) {
				throw new Error("Copied document is missing its article");
			}
			equal(getRenderedClipboardContent(body).text, fixture.text);
			equal(frameWindow.getComputedStyle(article).fontSize, "14px");
			equal(frameWindow.getComputedStyle(article).lineHeight, "20.3px");
		} finally {
			frame.remove();
		}
	} finally {
		element.remove();
	}
}

const cited = document.createElement("div");
const citedDraft = "Befund: `**CRP 112 mg/l.**`";
cited.innerHTML = renderToStaticMarkup(
	renderMarkdocAsReact(
		addScribeCitations(citedDraft, [
			{
				citations: [{ quote: 'CRP `112` "mg/l".', source: "mdscribe://input/notes" }],
				end: citedDraft.lastIndexOf("**") + 2,
				start: citedDraft.indexOf("**"),
			},
		]),
		{ layout: "template" },
	),
);
document.body.append(cited);
try {
	const { html, text } = getRenderedClipboardContent(cited);
	equal(text, "Befund: CRP 112 mg/l.");
	equal(html.includes("data-citation-source"), false);
	equal(html.includes("<mark"), false);
	equal(html.includes("<strong"), true);
	equal(cited.querySelectorAll("mark[data-citation-source]").length, 1);
} finally {
	cited.remove();
}

// An AIScribe answer's blank lines between sections are copied in both formats.
const sections = document.createElement("div");
const sectionDraft = "Befund:\nCRP 112 mg/l.\n\n- Na 140\n- K 3,4\n\nBeurteilung: stabil";
sections.innerHTML = renderToStaticMarkup(
	renderMarkdocAsReact(addScribeCitations(sectionDraft, []), { layout: "template" }),
);
document.body.append(sections);
try {
	const { html, text } = getRenderedClipboardContent(sections);
	equal(text, "Befund:\nCRP 112 mg/l.\n\n- Na 140\n- K 3,4\n\nBeurteilung: stabil");
	equal(html.split("&nbsp;").length - 1, 2);
} finally {
	sections.remove();
}

for (const [draft, expected] of [
	["Before. `CRP 112; Na 140.` After.", "Before. CRP 112; Na 140. After."],
	["Before.\n```text\nCRP 112; Na 140.\n```\nAfter.", "Before.\nCRP 112; Na 140.\nAfter."],
	["Before.\n~~~text\nCRP 112; Na 140.\n~~", "Before.\nCRP 112; Na 140."],
	["    CRP 112; Na 140.", "CRP 112; Na 140."],
	["`CRP 112; Na 140.", "CRP 112; Na 140."],
]) {
	const facts = ["Before.", "CRP 112", "Na 140.", "After."].filter((fact) => draft.includes(fact));
	const element = document.createElement("div");
	const source = 'mdscribe://input/notes`"\\special';
	const quote = 'CRP `112` "mg/l".\\\nNa 140.';
	element.innerHTML = renderToStaticMarkup(
		renderMarkdocAsReact(
			addScribeCitations(
				draft,
				facts.map((fact) => ({
					citations: [{ quote, source }],
					end: draft.indexOf(fact) + fact.length,
					start: draft.indexOf(fact),
				})),
			),
			{ layout: "template" },
		),
	);
	document.body.append(element);
	try {
		const marks = element.querySelectorAll<HTMLElement>("mark[data-citation-source]");
		equal(marks.length, facts.length);
		for (const [index, mark] of [...marks].entries()) {
			equal(mark.textContent, facts[index]);
			equal(mark.dataset.citationSource, source);
			equal(mark.dataset.citationQuote, quote);
		}
		equal(element.querySelectorAll("pre, code").length, 0);
		const { html, text } = getRenderedClipboardContent(element);
		equal(text.trim(), expected);
		equal(html.includes("data-citation-"), false);
		equal(html.includes("<mark"), false);
		equal(text.includes("{%"), false);
		equal(text.includes("`"), false);
	} finally {
		element.remove();
	}
}

document.documentElement.dataset.clipboardTest =
	"PASS: four clipboard fixtures, stylesheet-free paste, and helper-generated code/citation copying";
