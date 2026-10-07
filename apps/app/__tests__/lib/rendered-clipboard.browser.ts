// Browser regression: bun build __tests__/lib/rendered-clipboard.browser.ts --target browser --format=iife --outfile /tmp/rendered-clipboard-test.js
// agent-browser eval --stdin < /tmp/rendered-clipboard-test.js
import { renderToStaticMarkup } from "react-dom/server";

import renderMarkdocAsReact from "../../../../packages/markdoc-md/render/utils/render-markdoc-as-react";
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

document.documentElement.dataset.clipboardTest =
	"PASS: four clipboard fixtures and stylesheet-free paste";
