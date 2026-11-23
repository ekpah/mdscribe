// Real TipTap + Chromium regression. Build from the repo root, then load the bundle in a page:
// bun build packages/markdoc-md-editor/__tests__/markdown-editor-clipboard.browser.tsx --target browser --format=iife --outfile /tmp/markdown-editor-clipboard.js
// It sets document.title to "pass" or "fail: …".
import React from "react";
import { createRoot } from "react-dom/client";

import MarkdownEditor from "../markdown-editor";

let value = "**Dyspnoe** seit 3 Tagen.\n\n- KHK\n- DM2";
let submits = 0;
const element = document.createElement("div");
document.body.append(element);
createRoot(element).render(
	<MarkdownEditor
		onChange={(next) => {
			value = next;
		}}
		onSubmit={() => {
			submits += 1;
		}}
		value={value}
	/>,
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
const expectEqual = (actual: string, expected: string, what: string) => {
	if (actual !== expected) {
		throw new Error(`${what}: ${JSON.stringify(actual)} ≠ ${JSON.stringify(expected)}`);
	}
};

const selectAll = (surface: HTMLElement) => {
	surface.focus();
	surface.dispatchEvent(
		new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ctrlKey: true, key: "a" }),
	);
};
const copy = (surface: HTMLElement) => {
	selectAll(surface);
	const copied = new DataTransfer();
	surface.dispatchEvent(
		new ClipboardEvent("copy", { bubbles: true, cancelable: true, clipboardData: copied }),
	);
	return { html: copied.getData("text/html"), text: copied.getData("text/plain") };
};

void (async () => {
	await wait(() => Boolean(document.querySelector(".ProseMirror")), "editor unavailable");
	const surface = document.querySelector<HTMLElement>(".ProseMirror")!;

	// A copy keeps list markers in plain text and formatting in rich text.
	const list = copy(surface);
	if (!list.text.startsWith("Dyspnoe seit 3 Tagen.\n- KHK\n- DM2")) {
		throw new Error(`copied list: ${JSON.stringify(list.text)}`);
	}
	if (!list.html.includes("<strong>Dyspnoe</strong>")) {
		throw new Error(`copied HTML loses formatting: ${list.html}`);
	}

	// Pasted plain text keeps its empty line, which a paragraph per run of lines would drop.
	selectAll(surface);
	const pasted = new DataTransfer();
	pasted.setData("text/plain", "Fieber.\n\nAllergien: keine\n");
	surface.dispatchEvent(
		new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData: pasted }),
	);
	await wait(() => value.includes("Allergien"), "paste not applied");
	// The editor may keep an empty paragraph at the end.
	expectEqual(value.trimEnd(), "Fieber.\n\nAllergien: keine", "pasted text");

	// Lines copy as single line breaks, the empty line as one empty line, without paragraph spacing.
	const lines = copy(surface);
	expectEqual(lines.text.trimEnd(), "Fieber.\n\nAllergien: keine", "copied lines");
	if (!lines.html.includes(">&nbsp;</p>") || lines.html.includes("<p>")) {
		throw new Error(`copied HTML loses the empty line or keeps paragraph spacing: ${lines.html}`);
	}

	// ⌘↵ and Ctrl+↵ submit instead of inserting a line break.
	const before = surface.innerHTML;
	for (const modifier of [{ metaKey: true }, { ctrlKey: true }]) {
		surface.dispatchEvent(
			new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: "Enter", ...modifier }),
		);
	}
	expectEqual(String(submits), "2", "submits");
	expectEqual(surface.innerHTML, before, "content after ⌘↵");
	document.title = "pass";
})().catch((error: unknown) => {
	document.title = `fail: ${error instanceof Error ? error.message : String(error)}`;
});
