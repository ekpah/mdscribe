/**
 * Converts Markdoc tags to HTML format using custom elements that can be used with Tiptap.
 * Supports info, switch, and case tags.
 */

const headingPrefixes: Record<string, string> = {
	h1: "#",
	h2: "##",
	h3: "###",
	h4: "####",
	h5: "#####",
	h6: "######",
};

const inlineRenderers: Partial<Record<string, (innerContent: string) => string>> = {
	b: (innerContent) => `**${innerContent}**`,
	br: () => "\n",
	em: (innerContent) => `*${innerContent}*`,
	hr: () => "\n---\n\n",
	i: (innerContent) => `*${innerContent}*`,
	ol: (innerContent) => `${innerContent}\n`,
	p: (innerContent) => `${innerContent}\n\n`,
	strong: (innerContent) => `**${innerContent}**`,
	ul: (innerContent) => `${innerContent}\n`,
};

const quoteMarkdocValue = (value: string): string => JSON.stringify(value);

const readAttribute = (element: Element, name: string): string | null =>
	element.getAttribute(name) ?? element.getAttribute(name.toLowerCase());

const serializeStringAttribute = (name: string, value: string | null): string =>
	value ? ` ${name}=${quoteMarkdocValue(value)}` : "";

const serializeBooleanAttribute = (name: string, value: string | null): string =>
	value === "true" || value === "" ? ` ${name}=true` : "";

const decodeAttributeValue = (value: string | null): string | null => {
	if (!value) {
		return null;
	}

	try {
		return decodeURIComponent(value);
	} catch {
		return value;
	}
};

const customMarkdocRenderers: Partial<
	Record<string, (element: Element, innerContent: string) => string>
> = {
	case: (element, innerContent) => {
		const casePrimary = readAttribute(element, "primary") || "";
		const encodedCaseContent = readAttribute(element, "data-content");
		const decodedCaseContent = decodeAttributeValue(encodedCaseContent);
		const caseContent = decodedCaseContent
			? convertHtmlFragmentToMarkdoc(decodedCaseContent).trim()
			: innerContent.trim();
		return `{% case ${quoteMarkdocValue(casePrimary)} %}${caseContent}{% /case %}`;
	},
	info: (element) => {
		const infoPrimary = readAttribute(element, "primary") || "";
		const descriptionAttribute = serializeStringAttribute(
			"description",
			readAttribute(element, "description"),
		);
		const typeAttribute = serializeStringAttribute("type", readAttribute(element, "type"));
		const unitAttribute = serializeStringAttribute("unit", readAttribute(element, "unit"));
		const renderUnitAttribute = serializeBooleanAttribute(
			"renderUnit",
			readAttribute(element, "renderUnit") ?? readAttribute(element, "renderunit"),
		);
		return `{% info ${quoteMarkdocValue(infoPrimary)}${descriptionAttribute}${typeAttribute}${unitAttribute}${renderUnitAttribute} /%}`;
	},
	score: (element) => {
		const formula = readAttribute(element, "formula") || "";
		const primaryAttribute = serializeStringAttribute("primary", readAttribute(element, "primary"));
		const formulaAttribute = ` formula=${quoteMarkdocValue(formula)}`;
		const unitAttribute = serializeStringAttribute("unit", readAttribute(element, "unit"));
		const renderUnitAttribute = serializeBooleanAttribute(
			"renderUnit",
			readAttribute(element, "renderUnit") ?? readAttribute(element, "renderunit"),
		);
		return `{% score${primaryAttribute}${formulaAttribute}${unitAttribute}${renderUnitAttribute} /%}`;
	},
	switch: (element, innerContent) => {
		const switchPrimary = readAttribute(element, "primary") || "";
		const primary = quoteMarkdocValue(switchPrimary);
		const typeAttribute = serializeStringAttribute("type", readAttribute(element, "type"));
		return `{% switch ${primary}${typeAttribute} %}${innerContent}{% /switch %}`;
	},
};

const renderListItem = (element: Element, innerContent: string): string => {
	const parentTagName = element.parentElement?.tagName.toLowerCase();
	if (parentTagName === "ol") {
		return `1. ${innerContent.trim()}\n`;
	}
	return `- ${innerContent.trim()}\n`;
};

const renderBlockquote = (innerContent: string): string => {
	const lines = innerContent.trim().split("\n");
	return `${lines.map((line) => `> ${line}`).join("\n")}\n\n`;
};

const renderCode = (element: Element, innerContent: string): string => {
	const parentTagName = element.parentElement?.tagName.toLowerCase();
	if (parentTagName === "pre") {
		return innerContent;
	}
	return `\`${innerContent}\``;
};

const renderAnchor = (element: Element, innerContent: string): string => {
	const href = element.getAttribute("href") || "";
	return `[${innerContent}](${href})`;
};

const renderHeading = (tagName: string, innerContent: string): string => {
	const headingPrefix = headingPrefixes[tagName];
	return `${headingPrefix} ${innerContent}\n\n`;
};

const htmlElementRenderers: Partial<
	Record<string, (element: Element, innerContent: string) => string>
> = {
	a: renderAnchor,
	blockquote: (_element, innerContent) => renderBlockquote(innerContent),
	body: (_element, innerContent) => innerContent,
	code: renderCode,
	div: (_element, innerContent) => innerContent,
	html: (_element, innerContent) => innerContent,
	li: renderListItem,
	pre: (_element, innerContent) => `\`\`\`\n${innerContent}\n\`\`\`\n\n`,
	span: (_element, innerContent) => innerContent,
};

const renderHtmlElement = (element: Element, tagName: string, innerContent: string): string => {
	if (tagName in headingPrefixes) {
		return renderHeading(tagName, innerContent);
	}

	const htmlRenderer = htmlElementRenderers[tagName];
	if (htmlRenderer) {
		return htmlRenderer(element, innerContent);
	}

	const inlineRenderer = inlineRenderers[tagName];
	return inlineRenderer ? inlineRenderer(innerContent) : innerContent;
};

const processChildrenForMarkdoc = (
	node: Node,
	processNode: (childNode: Node) => string,
): string => {
	let innerContent = "";
	for (const child of node.childNodes) {
		innerContent += processNode(child);
	}
	return innerContent;
};

/**
 * Recursively processes a DOM node to convert custom Markdoc elements
 * and potentially standard HTML back into Markdoc or HTML string format.
 * This function is designed for client-side (browser) execution.
 * @param {Node} node - The DOM node to process.
 * @returns {string} The Markdoc or HTML string representation of the node.
 */
const processNodeForMarkdoc = (node: Node): string => {
	if (node.nodeType === Node.TEXT_NODE) {
		return node.textContent || "";
	}
	if (node.nodeType !== Node.ELEMENT_NODE) {
		return "";
	}

	const element = node as Element;
	const tagName = element.tagName.toLowerCase();
	const innerContent = processChildrenForMarkdoc(element, processNodeForMarkdoc);
	const customRenderer = customMarkdocRenderers[tagName];
	return customRenderer
		? customRenderer(element, innerContent)
		: renderHtmlElement(element, tagName, innerContent);
};

const convertHtmlFragmentToMarkdoc = (htmlFragment: string): string => {
	if (htmlFragment.length === 0) {
		return "";
	}
	if (typeof window === "undefined" || !window.DOMParser) {
		return htmlFragment;
	}

	const parser = new DOMParser();
	const doc = parser.parseFromString(`<div>${htmlFragment}</div>`, "text/html");
	const wrapper = doc.body.firstElementChild;
	if (!wrapper) {
		return htmlFragment;
	}

	return processChildrenForMarkdoc(wrapper, processNodeForMarkdoc);
};

/**
 * Convert HTML containing custom Markdoc elements (<markdoc-*>) back to Markdoc syntax.
 * Uses the browser's DOMParser for robust HTML parsing. This function is
 * intended for client-side execution.
 *
 * @param {string} html - String in HTML format, potentially containing <markdoc-info>,
 *               <markdoc-switch>, <markdoc-case>, and standard HTML elements.
 * @returns {string} String in Markdoc format mixed with any preserved HTML.
 */
export const htmlToMarkdoc = (html: string): string => {
	if (typeof window === "undefined" || !window.DOMParser) {
		console.error("DOMParser is not available. Cannot convert HTML to Markdoc.");
		// Fallback or throw error depending on desired behavior in non-browser env.
		return html;
	}

	const parser = new DOMParser();
	const doc = parser.parseFromString(html, "text/html");

	// Start processing from the body to skip implicit <html><head><body> tags
	// and handle potentially fragmented HTML inputs correctly.
	return processNodeForMarkdoc(doc.body);
};
