// Browser-only regression suite (uses the real DOMParser, no DOM mock).
// bun build __tests__/editor-roundtrip.browser.ts --target browser --outfile /tmp/markdoc-roundtrip.js
// agent-browser open about:blank && agent-browser eval --stdin < /tmp/markdoc-roundtrip.js
import { htmlToMarkdoc, renderTipTapHTML } from "../editor";

const equal = (actual: string, expected: string): void => {
	if (actual !== expected) {
		throw new Error(`Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
	}
};

const normalize = (html: string): string => {
	const doc = new DOMParser().parseFromString(html, "text/html");
	return (doc.querySelector("article") ?? doc.body).innerHTML;
};

const fragments = [
	"<p>first<br>second</p>",
	"<p>first<br><br>second</p>",
	"<p><br>first<br></p>",
	"<p><br><br></p>",
	"<p></p>",
	"<p></p><p>first</p><p></p><p></p><p>last</p><p></p>",
	"<p><strong>first</strong><br><em>second</em></p>",
	"<blockquote><p>first<br>second</p><p></p></blockquote>",
	"<ul><li>first<br>second</li></ul>",
	"<p>non-breaking space</p>",
	"<p><strong>first</strong> <em>second</em></p>",
];

for (const fragment of fragments) {
	let html = fragment;
	for (let cycle = 0; cycle < 3; cycle++) {
		html = renderTipTapHTML(htmlToMarkdoc(html));
		equal(normalize(html), normalize(fragment));
	}
}

equal(normalize(renderTipTapHTML("first\nsecond")), "<p>first<br>second</p>");
equal(
	normalize(renderTipTapHTML(htmlToMarkdoc('<p><br class="ProseMirror-trailingBreak"></p>'))),
	"<p></p>",
);

for (const tag of ["calc", "score"]) {
	const source = `{% ${tag} primary="result" formula="1" description=${JSON.stringify('A "quoted" result')} source="Observation.value" round=false %}{% /${tag} %}`;
	const first = renderTipTapHTML(source);
	const reopened = renderTipTapHTML(htmlToMarkdoc(first));
	equal(reopened, first);
	const calc = new DOMParser().parseFromString(reopened, "text/html").querySelector("calc");
	equal(calc?.getAttribute("description") ?? "", 'A "quoted" result');
	equal(calc?.getAttribute("source") ?? "", "Observation.value");
}

equal(
	htmlToMarkdoc('<Details summary="Laborwerte" open="true"><p>Text</p></Details>'),
	'{% details summary="Laborwerte" open=true %}\nText\n\n{% /details %}\n\n',
);
equal(
	htmlToMarkdoc('<Details open="false"><p>Text</p></Details>'),
	"{% details %}\nText\n\n{% /details %}\n\n",
);
const detailsInCase = htmlToMarkdoc(
	'<Switch primary="s"><Case primary="a"><p>Intro</p><Details summary="More"><p>Text</p></Details></Case><Case primary="b">B</Case></Switch>',
);
equal(
	detailsInCase,
	'{% switch "s" %}\n{% case "a" %}\nIntro\n\n{% details summary="More" %}\nText\n\n{% /details %}\n{% /case %}\n{% case "b" %}B{% /case %}\n{% /switch %}',
);
const parsedDetailsInCase = new DOMParser()
	.parseFromString(renderTipTapHTML(detailsInCase), "text/html")
	.querySelector("details");
equal(parsedDetailsInCase?.getAttribute("summary") ?? "", "More");
equal(parsedDetailsInCase?.textContent?.trim() ?? "", "Text");

for (const source of [
	'{% details summary="Laborwerte" %}\nText\n{% /details %}',
	"{% details %}\nText\n{% /details %}",
	'{% details summary="Laborwerte" open=true %}\nFirst\n\n- eins\n- zwei\n{% /details %}',
	'{% details summary="Vorbefunde" %}\nAuswärtig.\n\n{% details summary="Radiologie" %}\nRöntgen.\n{% /details %}\n{% /details %}',
]) {
	const first = renderTipTapHTML(source);
	const reopened = renderTipTapHTML(htmlToMarkdoc(first));
	equal(reopened, first);
	const details = new DOMParser().parseFromString(reopened, "text/html").querySelector("details");
	equal(details?.getAttribute("open") ?? "false", source.includes("open=true") ? "true" : "false");
	if (source.includes('summary="Laborwerte"')) {
		equal(details?.getAttribute("summary") ?? "", "Laborwerte");
	}
}

document.body.textContent = `${fragments.length * 3 + 15} browser roundtrip assertions passed`;
