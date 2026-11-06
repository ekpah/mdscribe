import type { ClipboardEvent } from "react";

import { getRenderedClipboardContent } from "@/lib/rendered-clipboard";

/**
 * Browsers leave input values out of copied selections. Copy a selection that
 * contains inline fields with their values as plain rendered text instead.
 */
export const copyInlineSelection = (event: ClipboardEvent<HTMLElement>) => {
	const selection = window.getSelection();
	if (
		event.target instanceof HTMLInputElement ||
		!selection ||
		selection.isCollapsed ||
		selection.rangeCount === 0
	) {
		return;
	}
	const container = document.createElement("div");
	container.append(selection.getRangeAt(0).cloneContents());
	const inputs = container.querySelectorAll<HTMLInputElement>("input[data-inline-input]");
	if (inputs.length === 0) {
		return;
	}
	for (const input of inputs) {
		input.replaceWith(input.getAttribute("value") ?? "");
	}
	const { html, text } = getRenderedClipboardContent(container);
	event.clipboardData.setData("text/html", html);
	event.clipboardData.setData("text/plain", text);
	event.preventDefault();
};
