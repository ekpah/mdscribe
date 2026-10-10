import { closeHistory } from "@tiptap/pm/history";
import type { Editor } from "@tiptap/react";
import { htmlToMarkdoc, renderTipTapHTML } from "markdoc-md/editor";
import { validateMarkdocTemplate } from "markdoc-md/parse";
import type { MarkdocTemplateDiagnostic } from "markdoc-md/parse";
import React from "react";
import { createRoot } from "react-dom/client";

import { updateMarkdocTagAttributes } from "../tag-inspector/use-selected-markdoc-tag";
import TipTap from "../tip-tap";

// Mount the product editor, including its actual paste handler and React node views.
const source = `{% condition ["a","b"] unit="kg" description="Vector details" %}{% case gt=[11,null] %}**bold** inner {% switch "deep" %}{% case "yes" %}***deep rich***{% /case %}{% /switch %}{% /case %}{% case default=true %}fallback{% /case %}{% /condition %}`;
const editors: (Editor | null)[] = [null, null];
let diagnostics: MarkdocTemplateDiagnostic[] = [];
const element = document.createElement("div");
document.body.append(element);
const root = createRoot(element);
root.render(
	<>
		<section id="first">
			<TipTap
				note={source}
				setContent={() => {}}
				autofocus={false}
				onValidationChange={(next) => {
					diagnostics = next;
				}}
				onEditorChange={(editor) => {
					editors[0] = editor;
				}}
			/>
		</section>
		<section id="second">
			<TipTap
				note=""
				setContent={() => {}}
				autofocus={false}
				onEditorChange={(editor) => {
					editors[1] = editor;
				}}
			/>
		</section>
	</>,
);
const wait = async (predicate: () => boolean, message: string) => {
	for (let i = 0; i < 100; i++) {
		if (predicate()) {
			return;
		}
		await new Promise((resolve) => setTimeout(resolve, 30));
	}
	throw new Error(message);
};
const check = (editor: Editor, expectMetadata: boolean) => {
	const text = htmlToMarkdoc(editor.getHTML());
	for (const required of [
		'condition ["a","b"]',
		"gt=[11,null]",
		'switch "deep"',
		"***deep rich***",
		"**bold**",
	]) {
		if (!text.includes(required)) {
			throw new Error(`clipboard lost ${required}: ${text}`);
		}
	}
	if (!expectMetadata) {
		return;
	}
	const html = editor.getHTML();
	if (!html.includes('unit="kg"') || !html.includes('description="Vector details"')) {
		throw new Error(`clipboard lost condition metadata: ${html}`);
	}
};
void (async () => {
	await wait(() => editors.every(Boolean), "editors unavailable");
	const original = editors[0]!;
	// Inheritance changes a distant node: it must share the paste's history event.
	original.commands.setContent(
		renderTipTapHTML(
			'{% switch "kind" %}{% case "a" %}Existing{% /case %}{% /switch %}\n\nSome separating text.',
		),
	);
	const beforeInheritance = original.getHTML();
	original.view.dispatch(closeHistory(original.state.tr));
	original.commands.setTextSelection(original.state.doc.content.size - 1);
	const inheritancePaste = new DataTransfer();
	inheritancePaste.setData(
		"text/plain",
		'{% switch "kind" %}{% case "a" value=2 %}Inserted{% /case %}{% /switch %}',
	);
	original.view.dom.dispatchEvent(
		new ClipboardEvent("paste", {
			clipboardData: inheritancePaste,
			bubbles: true,
			cancelable: true,
		}),
	);
	const afterInheritance = original.getHTML();
	if ((htmlToMarkdoc(afterInheritance).match(/value=2/g) ?? []).length !== 2) {
		throw new Error("Paste did not inherit the distant mapping");
	}
	for (let cycle = 0; cycle < 2; cycle++) {
		original.commands.undo();
		if (original.getHTML() !== beforeInheritance || !original.can().redo()) {
			throw new Error("Inheritance undo did not restore the original document and redo branch");
		}
		original.commands.redo();
		if (original.getHTML() !== afterInheritance) {
			throw new Error("Inheritance redo did not restore the paste and shared mapping together");
		}
	}
	const invalidCondition =
		'{% condition "x" %}{% case gt=0 value=5 %}Positive{% /case %}{% /condition %}';
	const invalidPaste = new DataTransfer();
	invalidPaste.setData("text/plain", invalidCondition);
	original.commands.clearContent();
	original.view.dom.dispatchEvent(
		new ClipboardEvent("paste", { clipboardData: invalidPaste, bubbles: true, cancelable: true }),
	);
	if (
		!htmlToMarkdoc(original.getHTML()).includes("value=5") ||
		!diagnostics.some(
			(item) => item.code === "case-condition-invalid" && item.reason === "condition-case-value",
		)
	) {
		throw new Error("Forbidden condition value disappeared before validation");
	}
	for (const [source, reason, retained] of [
		[
			'{% condition "x" %}{% case "unexpected" gt=0 %}Positive{% /case %}{% /condition %}',
			"primary-and-condition",
			'"unexpected"',
		],
		[
			'{% condition "x" %}{% case default=true gt=0 %}Positive{% /case %}{% /condition %}',
			"conflicting-operators",
			"gt=0",
		],
		[
			'{% condition ["x","y"] source="Observation.value" %}{% case gt=[0,null] %}Positive{% /case %}{% /condition %}',
			"group-source-unsupported",
			'source="Observation.value"',
		],
	]) {
		original.commands.setContent(renderTipTapHTML(source!));
		if (
			!diagnostics.some(
				(item) => item.code === "case-condition-invalid" && item.reason === reason,
			) ||
			!original.getText().includes(retained!)
		) {
			throw new Error(`Invalid condition attribute lost: ${source}`);
		}
	}

	const outside = '{% switch "kind" %}{% case "a" value=2 %}Outside{% /case %}{% /switch %}';
	original.commands.setContent(
		renderTipTapHTML(
			`${outside}{% switch "gate" %}{% case "show" %}{% calc "total" formula="[kind]*3" /%}{% /case %}{% /switch %}`,
		),
	);
	await wait(
		() =>
			[...original.view.dom.querySelectorAll("button[data-type='markdoc-switch']")].some((button) =>
				button.textContent?.includes("gate"),
			),
		"gate chip unavailable",
	);
	(
		[...original.view.dom.querySelectorAll("button[data-type='markdoc-switch']")].find((button) =>
			button.textContent?.includes("gate"),
		) as HTMLElement
	).click();
	await wait(
		() => (htmlToMarkdoc(original.getHTML()).match(/switch "kind"/g) ?? []).length === 2,
		"nested calc did not inherit the root switch",
	);
	if (diagnostics.some((item) => item.severity === "error")) {
		throw new Error(JSON.stringify(diagnostics));
	}
	const nestedSurface = document.querySelector("[data-testid='switch-content-editor'] .tiptap")!;
	const newDeclaration = new DataTransfer();
	newDeclaration.setData(
		"text/plain",
		'{% switch "newKind" %}{% case "a" value=7 %}New{% /case %}{% /switch %}{% calc "newTotal" formula="[newKind]*3" /%}',
	);
	nestedSurface.dispatchEvent(
		new ClipboardEvent("paste", { clipboardData: newDeclaration, bubbles: true, cancelable: true }),
	);
	await wait(
		() => (htmlToMarkdoc(original.getHTML()).match(/switch "newKind"/g) ?? []).length === 2,
		"nested paste failed to use its new local declaration",
	);
	if (diagnostics.some((item) => item.severity === "error")) {
		throw new Error(JSON.stringify(diagnostics));
	}
	(document.querySelector("[data-testid='switch-content-editor'] button") as HTMLElement).click();
	await wait(
		() => !document.querySelector("[data-testid='switch-content-editor']"),
		"nested editor did not close",
	);

	const nested =
		'{% condition ["gate","other"] %}{% case gt=[0,null] %}{% cite source="https://example.org" %}Evidence{% /cite %} {% switch "kind" %}{% case "a" %}Nested **text**{% /case %}{% /switch %}{% /case %}{% /condition %}';
	original.commands.setContent(renderTipTapHTML(outside + nested));
	if (!htmlToMarkdoc(original.getHTML()).includes('cite source="https://example.org"')) {
		throw new Error("Inheritance deleted a citation");
	}
	let outsidePos = -1;
	let conditionPos = -1;
	original.state.doc.descendants((node, pos) => {
		if (node.type.name === "switchTag") {
			outsidePos = pos;
		}
		if (node.type.name === "conditionTag") {
			conditionPos = pos;
		}
	});
	for (const value of [3, undefined]) {
		updateMarkdocTagAttributes(original, outsidePos, {
			cases: original.state.doc
				.nodeAt(outsidePos)!
				.attrs.cases.map((item: object) => ({ ...item, value })),
		});
		const text = htmlToMarkdoc(original.getHTML());
		if (!text.includes('cite source="https://example.org"')) {
			throw new Error("Mapping edit deleted a citation");
		}
		if (
			!text.includes("Nested **text**") ||
			(value === undefined ? text.includes("value=") : (text.match(/value=3/g) ?? []).length !== 2)
		) {
			throw new Error(`Nested mapping edit failed: ${text}`);
		}
	}
	const conditionCases = original.state.doc.nodeAt(conditionPos)!.attrs.cases;
	updateMarkdocTagAttributes(original, conditionPos, {
		cases: conditionCases.map((item: object) => ({
			...item,
			content: renderTipTapHTML(
				'{% switch "kind" %}{% case "a" value=9 %}Nested **text**{% /case %}{% /switch %}',
			),
		})),
	});
	if ((htmlToMarkdoc(original.getHTML()).match(/value=9/g) ?? []).length !== 2) {
		throw new Error("Nested-to-root mapping edit failed");
	}
	original.commands.setContent(
		renderTipTapHTML(
			`${outside}{% switch "gate" %}{% case "show" %}${outside}{% /case %}{% /switch %}`,
		),
	);
	await wait(
		() =>
			[...original.view.dom.querySelectorAll("button[data-type='markdoc-switch']")].some((button) =>
				button.textContent?.includes("gate"),
			),
		"gate unavailable",
	);
	(
		[...original.view.dom.querySelectorAll("button[data-type='markdoc-switch']")].find((button) =>
			button.textContent?.includes("gate"),
		) as HTMLElement
	).click();
	await wait(
		() => Boolean(document.querySelector("[data-testid='switch-content-editor'] .tiptap")),
		"nested editor unavailable",
	);
	(document.querySelector("[data-testid='switch-content-editor'] .tiptap") as HTMLElement).focus();
	await wait(() => editors[0] !== original && Boolean(editors[0]), "nested editor not reported");
	let childEditor = editors[0]!;
	let childPos = -1;
	childEditor.state.doc.descendants((node, pos) => {
		if (node.type.name === "switchTag") {
			childPos = pos;
		}
	});
	original.view.dispatch(closeHistory(original.state.tr));
	updateMarkdocTagAttributes(childEditor, childPos, {
		cases: [{ primary: "a", value: 9, text: "Existing", content: "Existing" }],
	});
	await wait(
		() => (htmlToMarkdoc(original.getHTML()).match(/value=9/g) ?? []).length === 2,
		"explicit nested edit did not reach root",
	);
	childEditor.commands.undo();
	await wait(
		() => (htmlToMarkdoc(original.getHTML()).match(/value=2/g) ?? []).length === 2,
		"nested undo did not restore global values",
	);
	childEditor.commands.redo();
	await wait(
		() => (htmlToMarkdoc(original.getHTML()).match(/value=9/g) ?? []).length === 2,
		"nested redo did not restore global values",
	);
	for (const [inputType, value] of [
		["historyUndo", 2],
		["historyRedo", 9],
	] as const) {
		if (!childEditor.isDestroyed) {
			childEditor.view.dom.dispatchEvent(
				new InputEvent("beforeinput", { bubbles: true, cancelable: true, inputType }),
			);
		}
		await wait(
			() =>
				(htmlToMarkdoc(original.getHTML()).match(new RegExp(`value=${value}`, "g")) ?? [])
					.length === 2,
			`native ${inputType} in a nested editor did not reach root history`,
		);
	}
	await new Promise((resolve) => setTimeout(resolve, 50));
	if (childEditor.isDestroyed) {
		(
			[...original.view.dom.querySelectorAll("button[data-type='markdoc-switch']")].find((button) =>
				button.textContent?.includes("gate"),
			) as HTMLElement
		).click();
		await wait(
			() => Boolean(document.querySelector("[data-testid='switch-content-editor'] .tiptap")),
			"history case unavailable",
		);
		(
			document.querySelector("[data-testid='switch-content-editor'] .tiptap") as HTMLElement
		).focus();
		await wait(
			() => Boolean(editors[0] && editors[0] !== original && !editors[0].isDestroyed),
			"history editor unavailable",
		);
		childEditor = editors[0]!;
	}
	original.view.dispatch(closeHistory(original.state.tr));
	childEditor.commands.setTextSelection(1);
	const conflicting = new DataTransfer();
	conflicting.setData(
		"text/plain",
		'{% switch "kind" %}{% case "a" value=7 %}Inserted{% /case %}{% /switch %}',
	);
	childEditor.view.dom.dispatchEvent(
		new ClipboardEvent("paste", { clipboardData: conflicting, bubbles: true, cancelable: true }),
	);
	await wait(
		() => diagnostics.some((item) => item.code === "case-value-conflict"),
		"paste silently overwrote existing mappings",
	);
	if ((htmlToMarkdoc(original.getHTML()).match(/value=9/g) ?? []).length !== 2) {
		throw new Error("paste changed existing numeric mappings");
	}
	childEditor.commands.undo();
	await wait(() => !htmlToMarkdoc(original.getHTML()).includes("value=7"), "paste undo failed");
	childEditor.commands.redo();
	await wait(
		() => diagnostics.some((item) => item.code === "case-value-conflict"),
		"paste redo failed to retain conflict",
	);
	if ((htmlToMarkdoc(original.getHTML()).match(/value=9/g) ?? []).length !== 2) {
		throw new Error("paste redo changed existing mappings");
	}
	(
		document.querySelector("[data-testid='switch-content-editor'] button") as HTMLElement | null
	)?.click();
	await wait(
		() => !document.querySelector("[data-testid='switch-content-editor']"),
		"case remained open",
	);
	for (const invalid of [
		'{% calc formula="1" /%}',
		'{% calc "   " formula="1" /%}',
		'{% switch "x" type="number" %}{% case gt=0 %}positive{% /case %}{% /switch %}',
	]) {
		original.commands.setContent(renderTipTapHTML(invalid));
		if (!diagnostics.some((item) => item.code === "markdoc-schema")) {
			throw new Error(`Editor accepted invalid schema: ${invalid}`);
		}
	}
	const declaration =
		'{% condition "gate" %}{% case gt=0 %}{% switch "kind" %}{% case "a" value=2 %}A{% /case %}{% case "b" value=7 %}B{% /case %}{% /switch %}{% /case %}{% /condition %}';
	const calculation = '{% calc "total" formula="[kind]*3" /%}';
	for (const template of [declaration + calculation, calculation + declaration]) {
		original.commands.setContent(renderTipTapHTML(template));
		if (diagnostics.some((item) => item.severity === "error")) {
			throw new Error(JSON.stringify(diagnostics));
		}
		let found = false;
		original.state.doc.descendants((node) => {
			if (node.type.name === "calcTag") {
				const child = node.attrs.components[0];
				found = child?.kind === "switch" && child.primary === "kind" && child.cases[1]?.value === 7;
			}
		});
		if (!found) {
			throw new Error("Calc did not inherit the nested switch declaration");
		}
	}
	original.commands.setContent(
		renderTipTapHTML(
			`{% switch "flag" type="boolean" %}{% case "true" value=5 %}First{% /case %}{% /switch %}{% switch "flag" type="boolean" %}{% case "true" %}Second{% /case %}{% /switch %}`,
		),
	);
	const positions: number[] = [];
	original.state.doc.descendants((node, pos) => {
		if (node.type.name === "switchTag") {
			positions.push(pos);
		}
	});
	for (const value of [5, 8, undefined]) {
		const cases = original.state.doc.nodeAt(positions[1]!)!.attrs.cases;
		updateMarkdocTagAttributes(original, positions[1]!, {
			cases: cases.map((item: Record<string, unknown>) =>
				item.primary === "true" ? { ...item, value, text: "Edited" } : item,
			),
		});
		for (const pos of positions) {
			const actual = original.state.doc
				.nodeAt(pos)!
				.attrs.cases.find((item: Record<string, unknown>) => item.primary === "true").value;
			if (actual !== value) {
				throw new Error(`Shared mapping expected ${value}, got ${actual}`);
			}
		}
	}
	for (const template of [source, `{% calc "result" formula="[a]+[b]" %}${source}{% /calc %}`]) {
		original.commands.setContent(renderTipTapHTML(template));
		original.commands.selectAll();
		const copied = new DataTransfer();
		original.view.dom.dispatchEvent(
			new ClipboardEvent("copy", { clipboardData: copied, bubbles: true, cancelable: true }),
		);
		if (!copied.getData("text/html") || !copied.getData("text/plain").includes("deep rich")) {
			throw new Error(
				`native copy omitted formats or nested content: ${copied.getData("text/plain")}`,
			);
		}
		if (copied.getData("text/plain").includes("type=")) {
			throw new Error(`plain condition serialization is invalid: ${copied.getData("text/plain")}`);
		}
		const serializedText = original.getText();
		if (
			!serializedText.includes('description="Vector details"') ||
			serializedText.includes("type=")
		) {
			throw new Error(`condition text serialization is invalid: ${serializedText}`);
		}
		for (const same of [false, true]) {
			for (const format of ["text/html", "text/plain", "both"]) {
				const target = same ? original : editors[1]!;
				target.commands.clearContent();
				const data = new DataTransfer();
				for (const mime of format === "both" ? ["text/html", "text/plain"] : [format]) {
					data.setData(mime, copied.getData(mime));
				}
				target.view.dom.dispatchEvent(
					new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }),
				);
				check(target, true);
			}
		}
	}
	// Plain-text copies use the saved serialization, so block case content survives.
	original.commands.setContent(
		renderTipTapHTML(
			'{% switch "s" %}\n{% case "a" %}\nIntro\n\n{% details summary="More" %}\nBody\n{% /details %}\n{% /case %}\n{% case "b" %}plain{% /case %}\n{% /switch %}',
		),
	);
	const copiedText = original.getText();
	if (
		!copiedText.includes('{% case "b" %}plain') ||
		validateMarkdocTemplate(copiedText).length > 0
	) {
		throw new Error(`plain-text copy of block case content is invalid: ${copiedText}`);
	}
	// Invalid literals stay invalid for validation instead of being normalized.
	original.commands.setContent(
		renderTipTapHTML('{% switch "s" %}{% case "a" value="1" %}A{% /case %}{% /switch %}'),
	);
	if (!htmlToMarkdoc(original.getHTML()).includes('value="1"')) {
		throw new Error(`string case value was normalized: ${htmlToMarkdoc(original.getHTML())}`);
	}
	// Renaming an option keeps the other occurrence's value for the new name.
	original.commands.setContent(
		renderTipTapHTML(
			'{% switch "s" %}{% case "low" value=1 %}L{% /case %}{% /switch %}{% switch "s" %}{% case "low" value=1 %}L2{% /case %}{% case "lo" value=5 %}X{% /case %}{% /switch %}',
		),
	);
	let renamedPos = -1;
	original.state.doc.descendants((node, pos) => {
		if (renamedPos < 0 && node.type.name === "switchTag") {
			renamedPos = pos;
		}
	});
	updateMarkdocTagAttributes(original, renamedPos, {
		cases: [{ ...original.state.doc.nodeAt(renamedPos)!.attrs.cases[0], primary: "lo" }],
	});
	if (!htmlToMarkdoc(original.getHTML()).includes('{% case "lo" value=5 %}X')) {
		throw new Error(
			`renaming an option overwrote another value: ${htmlToMarkdoc(original.getHTML())}`,
		);
	}
	// Dropping a formula variable never pairs unrelated calc components.
	original.commands.setContent(
		renderTipTapHTML(
			'{% info "a" type="number" /%} {% info "b" type="number" unit="kg" /%} {% calc "t" formula="[a]+[b]" /%}',
		),
	);
	let calcPos = -1;
	original.state.doc.descendants((node, pos) => {
		if (node.type.name === "calcTag") {
			calcPos = pos;
		}
	});
	const calcComponents = original.state.doc.nodeAt(calcPos)!.attrs.components as {
		primary: string;
	}[];
	updateMarkdocTagAttributes(original, calcPos, {
		components: calcComponents.filter((component) => component.primary === "b"),
		formula: "[b]",
	});
	if (!htmlToMarkdoc(original.getHTML()).startsWith('{% info "a" type="number" /%}')) {
		throw new Error(
			`removing a formula variable renamed another tag: ${htmlToMarkdoc(original.getHTML())}`,
		);
	}

	// Renaming a variable also renames its mentions inside case content and calcs.
	original.commands.setContent(
		renderTipTapHTML(
			'{% info "x" unit="mm" /%} {% switch "gate" %}{% case "on" %}Nested {% info "x" unit="mm" /%} and {% calc "y" formula="[x]*2" %}{% info "x" unit="mm" /%}{% /calc %}{% /case %}{% /switch %}',
		),
	);
	let infoPos = -1;
	original.state.doc.descendants((node, pos) => {
		if (infoPos < 0 && node.type.name === "infoTag") {
			infoPos = pos;
		}
	});
	updateMarkdocTagAttributes(original, infoPos, { primary: "z", unit: "cm" });
	const renamed = htmlToMarkdoc(original.getHTML());
	if (
		(renamed.match(/info "z"[^%]*unit="cm"/g) ?? []).length !== 3 ||
		renamed.includes('info "x"')
	) {
		throw new Error(`rename missed nested mentions: ${renamed}`);
	}
	if (!renamed.includes('formula="[z]*2"')) {
		throw new Error(`rename missed the formula in case content: ${renamed}`);
	}

	// Formulas and conditions anywhere follow a renamed variable.
	original.commands.setContent(
		renderTipTapHTML(
			'{% info "x" type="number" /%} {% calc "double" formula="[x]*2 + x" /%} {% condition ["x","y"] %}{% case gt=[1,null] %}big{% /case %}{% /condition %} {% switch "gate" %}{% case "on" %}{% condition "x" %}{% case gt=1 %}also{% /case %}{% /condition %}{% /case %}{% /switch %}',
		),
	);
	let numberPos = -1;
	original.state.doc.descendants((node, pos) => {
		if (numberPos < 0 && node.type.name === "infoTag") {
			numberPos = pos;
		}
	});
	updateMarkdocTagAttributes(original, numberPos, { primary: "weight" });
	const references = htmlToMarkdoc(original.getHTML());
	for (const expected of [
		'formula="[weight]*2 + weight"',
		'condition ["weight","y"]',
		'condition "weight"',
	]) {
		if (!references.includes(expected)) {
			throw new Error(`rename missed ${expected}: ${references}`);
		}
	}
	if (validateMarkdocTemplate(references).length > 0) {
		throw new Error(`rename left an invalid template: ${references}`);
	}

	// Shared changes reach copies inside case content as the editor renders them.
	const firstTagPos = (name: string) => {
		let found = -1;
		original.state.doc.descendants((node, pos) => {
			if (found < 0 && node.type.name === name) {
				found = pos;
			}
		});
		return found;
	};
	original.commands.setContent(
		renderTipTapHTML(
			'{% switch "s" %}{% case "a" %}A{% /case %}{% /switch %} {% switch "gate" %}{% case "on" %}{% switch "s" %}{% case "a" %}N{% /case %}{% /switch %}{% /case %}{% /switch %}',
		),
	);
	const checkboxPos = firstTagPos("switchTag");
	updateMarkdocTagAttributes(original, checkboxPos, {
		cases: [
			{ content: "", primary: "true", text: "" },
			{ content: "", primary: "false", text: "" },
		],
		type: "boolean",
	});
	const checkbox = htmlToMarkdoc(original.getHTML());
	if ((checkbox.match(/case "true"/g) ?? []).length !== 2 || checkbox.includes('\\"')) {
		throw new Error(`checkbox conversion corrupted a nested copy: ${checkbox}`);
	}
	original.commands.setContent(
		renderTipTapHTML(
			'{% calc "SV" formula="2" /%} {% calc "PAC" formula="[SV]+1" /%} {% switch "gate" %}{% case "on" %}{% calc "PAC" formula="[SV]+1" /%}{% /case %}{% /switch %}',
		),
	);
	updateMarkdocTagAttributes(original, firstTagPos("calcTag"), { primary: "SV2" });
	const calcRename = htmlToMarkdoc(original.getHTML());
	if (calcRename.includes('"SV"') || (calcRename.match(/\[SV2\]\+1/g) ?? []).length !== 2) {
		throw new Error(`renaming a calc left orphan references: ${calcRename}`);
	}
	original.commands.setContent(
		renderTipTapHTML(
			'{% info "a" type="number" /%} {% info "b" type="number" /%} {% calc "c" formula="[a]+[b]" /%} {% switch "gate" %}{% case "on" %}{% calc "c" formula="[a]+[b]" /%}{% /case %}{% /switch %}',
		),
	);
	const formulaCalcPos = firstTagPos("calcTag");
	updateMarkdocTagAttributes(original, formulaCalcPos, {
		components: (
			original.state.doc.nodeAt(formulaCalcPos)!.attrs.components as { primary: string }[]
		).filter((component) => component.primary === "a"),
		formula: "[a]",
	});
	const formulaCopy = htmlToMarkdoc(original.getHTML());
	if (
		(formulaCopy.match(/formula="\[a\]"/g) ?? []).length !== 2 ||
		formulaCopy.includes('calc "c" formula="[a]" %}{% info "a" type="number" /%}{% info "b"')
	) {
		throw new Error(`a formula edit did not update the copy's components: ${formulaCopy}`);
	}

	// A rename inside an open case also renames the copies outside it.
	original.commands.setContent(
		renderTipTapHTML(
			'{% info "outer" /%} {% calc "c" formula="[outer]+1" /%} {% switch "gate" %}{% case "on" %}In {% info "outer" /%}{% /case %}{% /switch %}',
		),
	);
	await wait(
		() =>
			[...original.view.dom.querySelectorAll("button[data-type='markdoc-switch']")].some((button) =>
				button.textContent?.includes("gate"),
			),
		"rename gate chip unavailable",
	);
	(
		[...original.view.dom.querySelectorAll("button[data-type='markdoc-switch']")].find((button) =>
			button.textContent?.includes("gate"),
		) as HTMLElement
	).click();
	await wait(
		() => Boolean(document.querySelector("[data-testid='switch-content-editor'] .tiptap")),
		"rename case editor unavailable",
	);
	(document.querySelector("[data-testid='switch-content-editor'] .tiptap") as HTMLElement).focus();
	await wait(
		() => editors[0] !== original && Boolean(editors[0]),
		"rename case editor not reported",
	);
	const caseEditor = editors[0]!;
	let nestedInfoPos = -1;
	caseEditor.state.doc.descendants((node, pos) => {
		if (node.type.name === "infoTag") {
			nestedInfoPos = pos;
		}
	});
	updateMarkdocTagAttributes(caseEditor, nestedInfoPos, { primary: "renamed" });
	await wait(
		() => {
			const text = htmlToMarkdoc(original.getHTML());
			return (
				!text.includes('"outer"') &&
				text.startsWith('{% info "renamed"') &&
				text.includes('formula="[renamed]+1"')
			);
		},
		`rename in a case editor did not reach the document: ${htmlToMarkdoc(original.getHTML())}`,
	);
	(document.querySelector("[data-testid='switch-content-editor'] button") as HTMLElement).click();
	await wait(
		() => !document.querySelector("[data-testid='switch-content-editor']"),
		"rename case editor did not close",
	);

	// Conditions expand their cases inline as tabs, like switches.
	original.commands.setContent(
		renderTipTapHTML(
			'{% condition ["a","b"] %}{% case gt=[11,null] %}First{% /case %}{% case default=true %}Other{% /case %}{% /condition %}',
		),
	);
	await wait(
		() => Boolean(original.view.dom.querySelector("button[data-type='markdoc-condition']")),
		"condition chip unavailable",
	);
	(original.view.dom.querySelector("button[data-type='markdoc-condition']") as HTMLElement).click();
	await wait(
		() =>
			document.querySelector("[data-testid='switch-content-editor'] [role='tablist']")
				?.textContent === "a > 11Sonst",
		`condition case tabs unavailable: ${document.querySelector("[data-testid='switch-content-editor']")?.textContent}`,
	);
	(document.querySelector("[data-testid='switch-content-editor'] .tiptap") as HTMLElement).focus();
	await wait(
		() => editors[0] !== original && Boolean(editors[0]),
		"condition case editor not reported",
	);
	editors[0]!.commands.insertContentAt(editors[0]!.state.doc.content.size - 1, " edited");
	await wait(
		() => htmlToMarkdoc(original.getHTML()).includes("First edited{% /case %}"),
		`inline condition case edit lost: ${htmlToMarkdoc(original.getHTML())}`,
	);
	root.unmount();
	document.body.dataset.testResult = "passed";
	document.body.textContent =
		"Actual product editor clipboard: standalone/calc condition metadata, HTML/plain/both, same/other editor passed";
})().catch((error) => {
	document.body.dataset.testResult = "failed";
	document.body.textContent =
		error instanceof Error ? (error.stack ?? error.message) : String(error);
	throw error;
});
