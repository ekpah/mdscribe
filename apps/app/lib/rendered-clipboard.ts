import { toast } from "sonner";

const isBreakOrEdge = (node: ChildNode | null) => !node || node.nodeName === "BR";
const isEmptyLine = (line: Element | null) =>
	line?.matches("[data-template-line]") === true && line.textContent === "\u00A0";

// AI instructions guide generation and are never part of the text. A line that
// held nothing else goes with them, so no empty line is left behind.
const removeAiInstructions = (clone: HTMLElement) => {
	for (const instruction of clone.querySelectorAll("[data-markdoc-ai]")) {
		const line = instruction.closest("[data-template-line]");
		// An instruction on its own row of a multi-line paragraph takes one of its breaks along.
		const { nextSibling, previousSibling } = instruction;
		if (isBreakOrEdge(previousSibling) && isBreakOrEdge(nextSibling)) {
			(nextSibling ?? previousSibling)?.remove();
		}
		instruction.remove();
		if (line && !line.textContent?.trim() && !line.querySelector("img, input, select, textarea")) {
			// Between two empty lines, one empty line keeps the paragraph gap.
			const next = line.nextElementSibling;
			if (isEmptyLine(line.previousElementSibling) && isEmptyLine(next)) {
				next?.remove();
			}
			line.remove();
		}
	}
};

/** Copy the rendered line structure without changing the visible disclosure state. */
export const getRenderedClipboardContent = (
	element: HTMLElement,
): { html: string; text: string } => {
	const clone = element.cloneNode(true) as HTMLElement;
	// Provenance is interactive UI, not part of the clinical text being pasted.
	for (const citation of clone.querySelectorAll("mark[data-citation-source]")) {
		citation.replaceWith(...citation.childNodes);
	}
	removeAiInstructions(clone);
	const html = clone.innerHTML;
	for (const section of clone.querySelectorAll<HTMLDetailsElement>("details")) {
		section.open = true;
	}
	// innerText omits native list markers. Include them in the plain-text format;
	// the untouched HTML format keeps real ordered/unordered lists.
	for (const list of clone.querySelectorAll<HTMLOListElement>("ol, ul")) {
		let index = list.tagName === "OL" ? list.start : 1;
		for (const item of list.children) {
			if (item.tagName !== "LI") {
				continue;
			}
			const marker = list.tagName === "OL" ? `${index}. ` : "- ";
			index += 1;
			const firstLine = item.querySelector(":scope > [data-template-line]") ?? item;
			firstLine.prepend(document.createTextNode(marker));
		}
	}
	// A connected clone gives innerText actual block separators. Nothing relies
	// on the preview's width or visual word wrapping, and the original stays untouched.
	clone.style.position = "fixed";
	clone.style.left = "-100000px";
	clone.style.top = "0";
	document.body.append(clone);
	try {
		// oxlint-disable-next-line unicorn/prefer-dom-node-text-content -- Clipboard text needs rendered block and hard-break separators, not concatenated text nodes.
		const text = clone.innerText
			.replaceAll("\r\n", "\n")
			.replaceAll("\r", "\n")
			.replaceAll(/^[\u00A0]+$/gm, "");
		return { html, text };
	} finally {
		clone.remove();
	}
};

/** Writes rich text with a plain-text fallback and reports the result as a toast. */
export const copyToClipboard = async ({ html, text }: { html: string; text: string }) => {
	try {
		await (typeof ClipboardItem === "undefined"
			? navigator.clipboard.writeText(text)
			: navigator.clipboard.write([
					new ClipboardItem({
						"text/html": new Blob([html], { type: "text/html" }),
						"text/plain": new Blob([text], { type: "text/plain" }),
					}),
				]));
		toast.success("Text kopiert");
		return true;
	} catch {
		toast.error("Kopieren fehlgeschlagen. Bitte manuell kopieren.");
		return false;
	}
};
