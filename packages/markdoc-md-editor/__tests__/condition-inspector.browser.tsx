import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { htmlToMarkdoc, renderTipTapHTML } from "markdoc-md/editor";
import { analyzeMarkdocTemplate, resolveCalculatedValues } from "markdoc-md/parse";
import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

import { CommonTagFields } from "../tag-inspector/common-tag-fields";
import { ConditionFields } from "../tag-inspector/condition-fields";
import { ConditionTagPanel } from "../tag-inspector/condition-tag-panel";
import { updateMarkdocTagAttributes } from "../tag-inspector/use-selected-markdoc-tag";
import { MarkdocMD } from "../tiptap-extension";
import type { SwitchCase } from "../tiptap-extension/editorNodes/switchTag/switch-tag";

const assert = (condition: unknown, message: string) => {
	if (!condition) {
		throw new Error(message);
	}
};
const source = `{% condition ["a","b"] %}{% case gt=[11,14] %}**rich**{% /case %}{% case default=true %}fallback{% /case %}{% /condition %}`;
const element = document.createElement("div");
document.body.append(element);
const editor = new Editor({
	element,
	extensions: [StarterKit, MarkdocMD],
	content: renderTipTapHTML(source + source),
});
let position = -1;
editor.state.doc.descendants((node, pos) => {
	if (position < 0 && node.type.name === "conditionTag") {
		position = pos;
	}
});
const attrs = () => editor.state.doc.nodeAt(position)!.attrs;
const ui = document.createElement("div");
document.body.append(ui);
const Harness = () => {
	const [, redraw] = useState(0);
	return (
		<ConditionFields
			available={["a", "b", "z"]}
			primary={attrs().primary}
			cases={attrs().cases}
			attributes={attrs()}
			update={(patch: Record<string, unknown>) => {
				updateMarkdocTagAttributes(editor, position, patch);
				redraw((v) => v + 1);
			}}
		/>
	);
};
const root = createRoot(ui);
root.render(<Harness />);
const tick = () => new Promise((resolve) => setTimeout(resolve, 50));
const click = async (label: string) => {
	const button = [...ui.querySelectorAll("button")].find(
		(item) => item.getAttribute("aria-label") === label || item.textContent?.trim() === label,
	);
	assert(button, `missing ${label}`);
	button!.click();
	await tick();
};
void (async () => {
	await tick();
	await click("Feld 2 nach oben");
	assert(JSON.stringify(attrs().primary) === '["b","a"]', "member reorder failed");
	assert(JSON.stringify(attrs().cases[0].gt) === "[14,11]", "threshold reorder failed");
	const groups: unknown[] = [];
	editor.state.doc.descendants((node) => {
		if (node.type.name === "conditionTag") {
			groups.push(node.attrs.primary);
		}
	});
	assert(JSON.stringify(groups) === '[["b","a"],["a","b"]]', "unrelated group mutated");
	const reordered = htmlToMarkdoc(editor.getHTML());
	const calc = analyzeMarkdocTemplate(
		`{% calc "weighted" formula="[a]*10+[b]" %}${reordered}{% /calc %}`,
	);
	assert(
		resolveCalculatedValues(calc.inputs, { a: 12, b: 15 }).weighted === 135,
		"reorder changed formula result",
	);
	editor.commands.undo();
	assert(
		JSON.stringify(attrs().primary) === '["a","b"]' &&
			JSON.stringify(attrs().cases[0].gt) === "[11,14]",
		"undo lost alignment",
	);
	editor.commands.redo();
	assert(JSON.stringify(attrs().cases[0].gt) === "[14,11]", "redo lost alignment");
	await click("+ z");
	assert(
		JSON.stringify(attrs().primary) === '["b","a","z"]' && attrs().cases[0].gt[2] === null,
		"adding an available field did not append a skip",
	);
	const previousConfirm = window.confirm;
	window.confirm = () => false;
	await click("Feld 3 entfernen");
	assert(attrs().primary.length === 3, "cancelled removal lost data");
	window.confirm = () => true;
	await click("Feld 3 entfernen");
	window.confirm = previousConfirm;
	assert(attrs().primary.length === 2, "confirmed removal failed");
	// Comparisons are chosen per field and stay positional.
	const select = ui.querySelector('[aria-label="Fall 1 a Vergleich"]') as HTMLSelectElement;
	select.value = "range";
	select.dispatchEvent(new Event("change", { bubbles: true }));
	await tick();
	assert(
		JSON.stringify(attrs().cases[0].gt) === "[14,null]" &&
			JSON.stringify(attrs().cases[0].gte) === "[null,11]" &&
			JSON.stringify(attrs().cases[0].lte) === "[null,11]",
		`range comparison misaligned: ${JSON.stringify(attrs().cases[0])}`,
	);
	const upper = ui.querySelector('[aria-label="Fall 1 a Obergrenze Wert"]') as HTMLInputElement;
	const setInput = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
	setInput.call(upper, "20,5");
	upper.dispatchEvent(new Event("input", { bubbles: true }));
	await tick();
	assert(JSON.stringify(attrs().cases[0].lte) === "[null,20.5]", "upper bound edit lost");
	assert(
		ui.textContent?.includes("Fall 1 · b > 14 · a ≥ 11 und ≤ 20.5"),
		`case label not updated: ${ui.textContent}`,
	);
	const fallback = ui.querySelector('[aria-label="Fall 2 b Vergleich"]');
	assert(!fallback, "fallback case offers comparisons");
	await click("Fall hinzufügen");
	assert(
		attrs().cases.length === 3 && attrs().cases[2].isDefault && !attrs().cases[1].isDefault,
		"new case was not inserted before the fallback",
	);
	root.unmount();
	editor.destroy();

	const scalarSource = `{% condition "score" unit="pt" description="Score" source="fhir.score" %}{% case gt=10 %}**high**{% /case %}{% /condition %}`;
	const scalarElement = document.createElement("div");
	document.body.append(scalarElement);
	const scalarEditor = new Editor({
		element: scalarElement,
		extensions: [StarterKit, MarkdocMD],
		content: renderTipTapHTML(scalarSource),
	});
	let scalarPosition = -1;
	scalarEditor.state.doc.descendants((node, pos) => {
		if (node.type.name === "conditionTag") {
			scalarPosition = pos;
		}
	});
	const scalarUi = document.createElement("div");
	document.body.append(scalarUi);
	const ScalarHarness = () => {
		const [, redraw] = useState(0);
		useEffect(() => {
			const handleTransaction = () => redraw((value) => value + 1);
			scalarEditor.on("transaction", handleTransaction);
			return () => {
				scalarEditor.off("transaction", handleTransaction);
			};
		}, []);
		return (
			<ConditionTagPanel
				editor={scalarEditor}
				node={scalarEditor.state.doc.nodeAt(scalarPosition)!}
				pos={scalarPosition}
			/>
		);
	};
	const scalarRoot = createRoot(scalarUi);
	scalarRoot.render(<ScalarHarness />);
	await tick();
	const newField = scalarUi.querySelector('[aria-label="Neues Feld"]') as HTMLInputElement;
	Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(
		newField,
		"second",
	);
	newField.dispatchEvent(new Event("input", { bubbles: true }));
	await tick();
	const addField = [...scalarUi.querySelectorAll("button")].find(
		(button) => button.textContent?.trim() === "Feld hinzufügen",
	);
	assert(addField, "scalar add-field control unavailable");
	addField!.click();
	await tick();
	const converted = scalarEditor.state.doc.nodeAt(scalarPosition)!.attrs;
	assert(
		JSON.stringify(converted.primary) === '["score","second"]',
		"scalar did not convert to vector",
	);
	assert(JSON.stringify(converted.cases[0].gt) === "[10,null]", "scalar predicate misaligned");
	assert(converted.source === null, "vector retained scalar-only source");
	assert(
		converted.unit === "pt" && converted.description === "Score",
		"vector-local metadata lost",
	);
	const convertedText = scalarEditor.getText();
	assert(
		!convertedText.includes("source=") && !convertedText.includes("type="),
		"internal metadata leaked",
	);
	scalarRoot.unmount();
	scalarEditor.destroy();
	// Names apply to the whole variable when editing ends, so intermediate names
	// never merge with another variable, and retyping through empty keeps mentions together.
	const renameScenario = async (
		source: string,
		steps: string[],
		check: (markdoc: string) => boolean,
		message: string,
	) => {
		const renameEditor = new Editor({
			content: renderTipTapHTML(source),
			element: document.createElement("div"),
			extensions: [StarterKit, MarkdocMD],
		});
		const renameUi = document.createElement("div");
		document.body.append(renameUi);
		const RenameHarness = () => {
			const [, redraw] = useState(0);
			useEffect(() => {
				const handleTransaction = () => redraw((value) => value + 1);
				renameEditor.on("transaction", handleTransaction);
				return () => {
					renameEditor.off("transaction", handleTransaction);
				};
			}, []);
			return (
				<CommonTagFields editor={renameEditor} node={renameEditor.state.doc.nodeAt(1)!} pos={1} />
			);
		};
		const renameRoot = createRoot(renameUi);
		renameRoot.render(<RenameHarness />);
		await tick();
		const nameInput = renameUi.querySelector("input") as HTMLInputElement;
		nameInput.focus();
		for (const value of steps) {
			Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(
				nameInput,
				value,
			);
			nameInput.dispatchEvent(new Event("input", { bubbles: true }));
			await tick();
		}
		nameInput.blur();
		await tick();
		const markdoc = htmlToMarkdoc(renameEditor.getHTML());
		assert(check(markdoc), `${message}: ${markdoc}`);
		renameRoot.unmount();
		renameEditor.destroy();
	};
	await renameScenario(
		'{% info "a" /%} {% info "a" /%}',
		["", "b"],
		(markdoc) => (markdoc.match(/info "b"/g) ?? []).length === 2,
		"retyped name detached mentions",
	);
	await renameScenario(
		'{% info "a" type="number" /%} {% info "ab" type="number" /%} {% calc "c" formula="[a]+[ab]" /%}',
		["ab", "abc"],
		(markdoc) =>
			markdoc.includes('{% info "abc" type="number" /%} {% info "ab" type="number" /%}') &&
			markdoc.includes('formula="[abc]+[ab]"'),
		"an intermediate name merged with another variable",
	);
	await renameScenario(
		'{% info "a" /%} {% info "a" /%}',
		[""],
		(markdoc) => (markdoc.match(/info "a"/g) ?? []).length === 2,
		"an emptied name did not revert",
	);
	document.body.dataset.testResult = "passed";
	document.body.textContent =
		"Condition inspector reorder, independent groups, undo/redo, add/remove, per-field comparisons and scalar conversion checks passed";
})().catch((error) => {
	document.body.dataset.testResult = "failed";
	document.body.textContent = String(error);
	throw error;
});
