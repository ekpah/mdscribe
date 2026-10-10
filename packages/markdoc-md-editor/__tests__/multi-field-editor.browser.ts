// Real TipTap + Chromium regression. Build from repo root with Bun, then evaluate in a browser.
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { htmlToMarkdoc, renderTipTapHTML } from "markdoc-md/editor";
import { analyzeMarkdocTemplate, resolveCalculatedValues } from "markdoc-md/parse";

import { MarkdocMD } from "../tiptap-extension";
import { ensureCalcFormulaComponents } from "../tiptap-extension/editorNodes/calcTag/calc-tag";
import { normalizeBooleanSwitchCases } from "../tiptap-extension/editorNodes/switchTag/switch-tag";

const source = `{% calc "weighted" formula="[a]*10+[b]" %}{% condition ["a","b"] description="Vector details" unit="mm" %}{% case gt=[11,14] %}**Rich** {% switch "inner" %}{% case "yes" value=2 %}nested {% info "note" /%}{% /case %}{% case "no" %}other{% /case %}{% /switch %}{% /case %}{% case default=true %}fallback{% /case %}{% /condition %}{% condition "c" description="Scalar details" unit="kg" source="weight" %}{% case gt=1 %}large{% /case %}{% /condition %}{% /calc %}`;
const assert = (condition: unknown, message: string) => {
	if (!condition) {
		throw new Error(message);
	}
};
const editors: Editor[] = [];
const create = (content: string) => {
	const element = document.createElement("div");
	document.body.append(element);
	const editor = new Editor({ element, extensions: [StarterKit, MarkdocMD], content });
	editors.push(editor);
	return editor;
};
const check = (editor: Editor) => {
	const text = htmlToMarkdoc(editor.getHTML());
	assert(text.includes('condition ["a","b"]'), "member order lost");
	assert(text.includes("gt=[11,14]"), "thresholds lost");
	for (const metadata of [
		'description="Vector details"',
		'unit="mm"',
		'description="Scalar details"',
		'unit="kg"',
		'source="weight"',
	]) {
		assert(text.includes(metadata), `condition metadata lost: ${metadata}`);
	}
	assert(text.includes('switch "inner"') && text.includes('info "note"'), "nested content lost");
	assert(text.includes("**Rich**"), "rich formatting lost");
	const analysis = analyzeMarkdocTemplate(text);
	assert(
		!analysis.diagnostics.some((entry) => entry.severity === "error"),
		JSON.stringify(analysis.diagnostics),
	);
	assert(
		resolveCalculatedValues(analysis.inputs, { a: 12, b: 15 }).weighted === 135,
		"calc result changed",
	);
};
try {
	const normalized = normalizeBooleanSwitchCases([{ primary: "true", text: "Yes", value: 5 }]);
	assert(
		normalized[0]?.value === 5 && normalized[1]?.value === undefined,
		"checkbox normalization discarded a custom mapping",
	);
	const original = create(renderTipTapHTML(source));
	for (let cycle = 0; cycle < 3; cycle++) {
		check(original);
		original.commands.setContent(renderTipTapHTML(htmlToMarkdoc(original.getHTML())));
	}
	original.commands.selectAll();
	const clipboard = original.view.serializeForClipboard(original.state.selection.content());
	assert(clipboard.text.includes('switch "inner"'), "plain clipboard omitted nested switch");
	for (const sameEditor of [false, true]) {
		for (const format of ["html", "plain"]) {
			const target = sameEditor ? original : create("");
			target.commands.clearContent();
			if (format === "html") {
				target.view.pasteHTML(clipboard.dom.innerHTML);
			} else {
				target.commands.insertContent(renderTipTapHTML(clipboard.text));
			}
			check(target);
		}
	}
	const special = create(
		renderTipTapHTML(
			`{% condition ["a,[]", "b\\\"c"] %}{% case gt=[1,null] %}ok{% /case %}{% /condition %}{% switch "a,[]" %}{% case "x" %}scalar{% /case %}{% /switch %}`,
		),
	);
	const values: unknown[] = [];
	special.state.doc.descendants((node) => {
		if (node.type.name === "conditionTag" || node.type.name === "switchTag") {
			values.push(node.attrs.primary);
		}
	});
	assert(
		JSON.stringify(values) === JSON.stringify([["a,[]", 'b"c'], "a,[]"]),
		"scalar and array identities conflated",
	);
	const reused = create(
		renderTipTapHTML(
			`{% switch "smoker" type="boolean" %}{% case "true" %}{% info "packyears" type="number" /%} PY{% /case %}{% case "false" %}nie{% /case %}{% /switch %} {% calc "risk" formula="[smoker]*2+PI" /%}`,
		),
	);
	const reuse = reused.state.tr;
	assert(ensureCalcFormulaComponents(reuse), "formula switch was not added to the calc");
	reused.view.dispatch(reuse);
	const reusedText = htmlToMarkdoc(reused.getHTML());
	assert(
		reusedText.split('info "packyears"').length === 2,
		`switch case content copied into the calc: ${reusedText}`,
	);
	assert(!reusedText.includes('info "PI"'), `formula constant became an input: ${reusedText}`);
	document.body.dataset.testResult = "passed";
} finally {
	for (const editor of editors) {
		editor.destroy();
	}
}
document.body.textContent =
	"Condition TipTap roundtrip, HTML/plain clipboard and nested content assertions passed";
