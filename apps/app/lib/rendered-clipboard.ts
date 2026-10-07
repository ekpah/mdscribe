/** Copy the rendered line structure without changing the visible disclosure state. */
export const getRenderedClipboardContent = (
	element: HTMLElement,
): { html: string; text: string } => {
	const html = element.innerHTML;
	const clone = element.cloneNode(true) as HTMLElement;
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
