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

const staysStableForThreeCycles = (fragment: string): void => {
	let html = fragment;
	for (let cycle = 0; cycle < 3; cycle++) {
		html = renderTipTapHTML(htmlToMarkdoc(html));
		equal(normalize(html), normalize(fragment));
	}
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
	'<h2>Heading</h2><Details open="false"><p>Text</p></Details>',
	"<p>non-breaking space</p>",
	"<p><strong>first</strong> <em>second</em></p>",
];

for (const fragment of fragments) {
	staysStableForThreeCycles(fragment);
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
equal(
	htmlToMarkdoc('<h2>Heading</h2><Details open="false"><p>Text</p></Details>'),
	"## Heading\n{% details %}\nText\n\n{% /details %}\n\n",
);
const detailsInCase = htmlToMarkdoc(
	'<Switch primary="s"><Case primary="a"><p>Intro</p><Details summary="More"><p>Text</p></Details></Case><Case primary="b">B</Case></Switch>',
);
equal(
	detailsInCase,
	'{% switch "s" %}\n{% case "a" %}\nIntro\n{% details summary="More" %}\nText\n\n{% /details %}\n{% /case %}\n{% case "b" %}B{% /case %}\n{% /switch %}',
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
	'Vorher\n{% details summary="A" %}\nText\n{% /details %}\nNachher',
	'Vorher\n\n{% details summary="A" %}\nText\n{% /details %}\n\nNachher',
	'{% details summary="A" %}\na\n{% /details %}\n{% details summary="B" %}\nb\n{% /details %}\n\n&nbsp;\n\nNachher',
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

// Line flow: a section written against its neighbours stays flush; an empty
// editor line next to it is the blank source line that keeps the paragraph gap.
equal(
	htmlToMarkdoc(
		'<p>01/24 Erstdiagnose</p><Details summary="02/24 Chemo"><p>Zyklus 1</p></Details><Details summary="03/24 OP"><p>OP</p></Details><p>04/24 Staging</p><p></p><Details summary="05/24"><p>x</p></Details><p></p><p><strong>Nebendiagnosen:</strong></p>',
	),
	'01/24 Erstdiagnose\n{% details summary="02/24 Chemo" %}\nZyklus 1\n\n{% /details %}\n{% details summary="03/24 OP" %}\nOP\n\n{% /details %}\n04/24 Staging\n\n{% details summary="05/24" %}\nx\n\n{% /details %}\n\n**Nebendiagnosen:**\n\n',
);
equal(
	normalize(renderTipTapHTML(htmlToMarkdoc("<p>A</p><p></p><p></p><Details><p>x</p></Details>"))),
	'<p>A</p><p></p><p></p><details open="false"><p>x</p></details>',
);

// Empty editor lines around sections are lossless at document boundaries,
// beside non-line-flow blocks, in runs, and inside nested section content.
for (const fragment of [
	'<p></p><Details open="false"><p>x</p></Details>',
	'<Details open="false"><p>x</p></Details><p></p>',
	'<h2>Heading</h2><p></p><Details open="false"><p>x</p></Details>',
	'<Details open="false"><p>x</p></Details><p></p><h2>Heading</h2>',
	'<Details open="false" summary="A"><p>a</p></Details><p></p><p></p><Details open="false" summary="B"><p>b</p></Details>',
	'<Details open="false" summary="Outer"><p></p><Details open="false" summary="Inner"><p>x</p></Details><p></p></Details>',
]) {
	staysStableForThreeCycles(fragment);
}

const encodedCaseContent = encodeURIComponent(
	'<p>Before</p><p></p><Details summary="Nested"><p>x</p></Details><p></p><p>After</p>',
);
const caseSource = htmlToMarkdoc(
	`<Switch primary="choice"><Case primary="yes" data-content="${encodedCaseContent}"></Case></Switch>`,
);
let reopenedCase = renderTipTapHTML(caseSource);
for (let cycle = 0; cycle < 3; cycle++) {
	const caseElement = new DOMParser()
		.parseFromString(reopenedCase, "text/html")
		.querySelector("case");
	equal(
		normalize(caseElement?.innerHTML ?? ""),
		'<p>Before</p><p></p><details open="false" summary="Nested"><p>x</p></details><p></p><p>After</p>',
	);
	reopenedCase = renderTipTapHTML(htmlToMarkdoc(reopenedCase));
}

document.body.textContent = `${fragments.length * 3 + 44} browser roundtrip assertions passed`;
