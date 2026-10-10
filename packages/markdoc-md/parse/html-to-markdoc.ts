/**
 * Converts Markdoc tags to HTML format using custom elements that can be used with Tiptap.
 * Supports cite, details, info, switch, and case tags.
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
	br: () => "  \n",
	em: (innerContent) => `*${innerContent}*`,
	hr: () => "\n---\n\n",
	i: (innerContent) => `*${innerContent}*`,
	ol: (innerContent) => `${innerContent}\n`,
	// Entity-only lines survive Markdown parsing, including empty paragraphs
	// and padding before/after consecutive or boundary hard breaks.
	p: (innerContent) => `${preserveEmptyLines(innerContent)}\n\n`,
	strong: (innerContent) => `**${innerContent}**`,
	ul: (innerContent) => `${innerContent}\n`,
};

const preserveEmptyLines = (content: string): string => {
	const lines = content.split("\n");
	return lines
		.map((line, index) => (line.trim() ? line : `&nbsp;${index < lines.length - 1 ? "  " : ""}`))
		.join("\n");
};

const quoteMarkdocValue = (value: string): string => JSON.stringify(value);

const readAttribute = (element: Element, name: string): string | null =>
	element.getAttribute(name) ?? element.getAttribute(name.toLowerCase());

const serializeStringAttribute = (name: string, value: string | null): string =>
	value ? ` ${name}=${quoteMarkdocValue(value)}` : "";

/** Invalid stored values are kept as strings, so validation still reports them. */
const serializeBooleanAttribute = (name: string, value: string | null): string => {
	if (value === "true" || value === "") {
		return ` ${name}=true`;
	}
	return value === null || value === "false" ? "" : ` ${name}=${JSON.stringify(value)}`;
};

/**
 * Case values and comparisons are JSON literals in editor HTML; anything else
 * is kept as a string, so validation still reports it and no constraint is lost.
 */
const serializeNumericAttribute = (name: string, raw: string | null): string => {
	if (raw === null || raw === "") {
		return "";
	}
	try {
		return ` ${name}=${JSON.stringify(JSON.parse(raw))}`;
	} catch {
		return ` ${name}=${JSON.stringify(raw)}`;
	}
};

const serializeRoundAttribute = (value: string | null): string => {
	if (value === "false") {
		return " round=false";
	}
	const round = value === null || value === "" ? Number.NaN : Number(value);
	return Number.isInteger(round) && round >= 0 && round <= 100 ? ` round=${round}` : "";
};

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

let convertHtmlFragmentToMarkdoc = (htmlFragment: string): string => htmlFragment;

/** Details and tables are block tags and must begin on their own line. */
const containsBlockTag = (content: string): boolean => /\{% (?:details|table)\b/u.test(content);

/**
 * A case containing block content needs the switch or condition delimiters on
 * their own lines too, for Markdoc to parse the tree.
 */
const caseListContent = (innerContent: string): string =>
	containsBlockTag(innerContent) ? `\n${innerContent.trim()}\n` : innerContent;

const customMarkdocRenderers: Partial<
	Record<string, (element: Element, innerContent: string) => string>
> = {
	calc: (element, innerContent) => {
		const formula = readAttribute(element, "formula") || "";
		const primaryAttribute = serializeStringAttribute("primary", readAttribute(element, "primary"));
		const formulaAttribute = ` formula=${quoteMarkdocValue(formula)}`;
		const unitAttribute = serializeStringAttribute("unit", readAttribute(element, "unit"));
		const descriptionAttribute = serializeStringAttribute(
			"description",
			readAttribute(element, "description"),
		);
		const sourceAttribute = serializeStringAttribute("source", readAttribute(element, "source"));
		const roundAttribute = serializeRoundAttribute(readAttribute(element, "round"));
		const renderUnitAttribute = serializeBooleanAttribute(
			"renderUnit",
			readAttribute(element, "renderUnit") ?? readAttribute(element, "renderunit"),
		);
		return `{% calc${primaryAttribute}${formulaAttribute}${unitAttribute}${descriptionAttribute}${sourceAttribute}${roundAttribute}${renderUnitAttribute} %}${innerContent}{% /calc %}`;
	},
	case: (element, innerContent) => {
		const casePrimary = readAttribute(element, "primary") || "";
		const encodedCaseContent = readAttribute(element, "data-content");
		const decodedCaseContent = decodeAttributeValue(encodedCaseContent);
		const caseContent = decodedCaseContent
			? convertHtmlFragmentToMarkdoc(decodedCaseContent).trim()
			: innerContent.trim();
		// Cases are normally inline, but block content must begin on its own
		// line. This includes cases with prose before it and keeps sibling case
		// delimiters from sharing the block case's closing line.
		const containsBlock = containsBlockTag(caseContent);
		const rawValue = readAttribute(element, "value");
		const valueAttribute = serializeNumericAttribute("value", rawValue);
		const conditionAttributes = ["eq", "gt", "gte", "lt", "lte"]
			.map((operator) => serializeNumericAttribute(operator, readAttribute(element, operator)))
			.join("");
		const defaultAttribute = serializeBooleanAttribute(
			"default",
			readAttribute(element, "default"),
		);
		// Condition cases carry no primary key; an invalid primary is preserved so
		// validation can diagnose it.
		const openingTag =
			conditionAttributes || defaultAttribute
				? `{% case${casePrimary ? ` ${quoteMarkdocValue(casePrimary)}` : ""}${conditionAttributes}${defaultAttribute}${valueAttribute} %}`
				: `{% case ${quoteMarkdocValue(casePrimary)}${valueAttribute} %}`;
		if (containsBlock) {
			return `\n${openingTag}\n${caseContent}\n{% /case %}\n`;
		}
		return `${openingTag}${caseContent}{% /case %}`;
	},
	condition: (element, innerContent) => {
		const rawPrimary = readAttribute(element, "primary") || "";
		const primary =
			readAttribute(element, "data-primary-json") === "true"
				? rawPrimary
				: quoteMarkdocValue(rawPrimary);
		const attributes = ["unit", "description", "source"]
			.map((key) => serializeStringAttribute(key, readAttribute(element, key)))
			.join("");
		return `{% condition ${primary}${attributes} %}${caseListContent(innerContent)}{% /condition %}`;
	},
	cite: (element, innerContent) => {
		const source = readAttribute(element, "source") || "";
		const quoteAttribute = serializeStringAttribute("quote", readAttribute(element, "quote"));
		return `{% cite source=${quoteMarkdocValue(source)}${quoteAttribute} %}${innerContent}{% /cite %}`;
	},
	details: (element, innerContent) => {
		const summaryAttribute = serializeStringAttribute("summary", readAttribute(element, "summary"));
		const openAttribute = serializeBooleanAttribute("open", readAttribute(element, "open"));
		// Block form: the opening tag needs its own line, otherwise Markdoc parses
		// the section as an inline tag nested in a paragraph. The trailing blank
		// line keeps consecutive closing tags off each other's lines; the parent
		// drops it when the next block continues the section's line flow.
		return `{% details${summaryAttribute}${openAttribute} %}\n${innerContent}{% /details %}\n\n`;
	},
	info: (element) => {
		const infoPrimary = readAttribute(element, "primary") || "";
		const descriptionAttribute = serializeStringAttribute(
			"description",
			readAttribute(element, "description"),
		);
		const typeAttribute = serializeStringAttribute("type", readAttribute(element, "type"));
		const unitAttribute = serializeStringAttribute("unit", readAttribute(element, "unit"));
		const roundAttribute = serializeRoundAttribute(readAttribute(element, "round"));
		const renderUnitAttribute = serializeBooleanAttribute(
			"renderUnit",
			readAttribute(element, "renderUnit") ?? readAttribute(element, "renderunit"),
		);
		const sourceAttribute = serializeStringAttribute("source", readAttribute(element, "source"));
		return `{% info ${quoteMarkdocValue(infoPrimary)}${descriptionAttribute}${typeAttribute}${unitAttribute}${roundAttribute}${renderUnitAttribute}${sourceAttribute} /%}`;
	},
	// Legacy editor HTML is normalized to canonical calc syntax.
	score: (element, innerContent) => customMarkdocRenderers.calc?.(element, innerContent) ?? "",
	switch: (element, innerContent) => {
		const switchPrimary = readAttribute(element, "primary") || "";
		const primary =
			readAttribute(element, "data-primary-json") === "true"
				? switchPrimary
				: quoteMarkdocValue(switchPrimary);
		const sourceAttribute = serializeStringAttribute("source", readAttribute(element, "source"));
		const typeAttribute = serializeStringAttribute("type", readAttribute(element, "type"));
		const unitAttribute = serializeStringAttribute("unit", readAttribute(element, "unit"));
		const descriptionAttribute = serializeStringAttribute(
			"description",
			readAttribute(element, "description"),
		);
		return `{% switch ${primary}${typeAttribute}${unitAttribute}${descriptionAttribute}${sourceAttribute} %}${caseListContent(innerContent)}{% /switch %}`;
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
	return `${headingPrefix} ${preserveEmptyLines(innerContent)}\n\n`;
};

const renderTable = (element: Element, processNode: (node: Node) => string): string => {
	const rows = [...(element as HTMLTableElement).rows];
	const hasHeader =
		rows[0]?.cells.length > 0 && [...rows[0].cells].every((cell) => cell.tagName === "TH");
	const content = rows
		.map((row) =>
			[...row.cells]
				.map((cell) => {
					const paragraph =
						cell.children.length === 1 && cell.firstElementChild?.tagName === "P"
							? cell.firstElementChild
							: cell;
					let source = preserveEmptyLines(
						[...paragraph.childNodes].map(processNode).join(""),
					).trimEnd();
					const spans = ["colspan", "rowspan"].flatMap((name) => {
						const value = Number(cell.getAttribute(name));
						return value > 1 ? [`${name}=${value}`] : [];
					});
					if (spans.length > 0) {
						source += `{% ${spans.join(" ")} %}`;
					}
					const lines = source.split("\n");
					return `* ${lines[0]}${lines
						.slice(1)
						.map((line) => `\n  ${line}`)
						.join("")}`;
				})
				.join("\n"),
		)
		.join("\n---\n");
	return `{% table %}\n${hasHeader ? "" : "---\n"}${content}\n{% /table %}\n\n`;
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

const isElementNamed = (node: Node | null, tagName: string): node is Element =>
	node?.nodeType === 1 && (node as Element).tagName.toLowerCase() === tagName;

/** An empty editor line: `<p></p>`, optionally holding ProseMirror's view-only filler. */
const isEmptyParagraph = (node: Node | null): boolean =>
	isElementNamed(node, "p") &&
	node.textContent === "" &&
	[...node.children].every((child) => child.classList.contains("ProseMirror-trailingBreak"));

/**
 * Blocks a details section can join; mirrors `markDetailsLineFlow` in the
 * renderer. An empty paragraph that stays in the source (as `&nbsp;`) is a
 * paragraph there too.
 */
const sharesLineFlow = (node: Node | null): boolean =>
	isElementNamed(node, "details") || isElementNamed(node, "p");

/** Adjacent block, skipping formatting whitespace between elements. */
const siblingBlock = (node: Node, direction: "nextSibling" | "previousSibling"): Node | null => {
	let sibling = node[direction];
	while (sibling?.nodeType === 3 && !sibling.textContent?.trim()) {
		sibling = sibling[direction];
	}
	return sibling;
};

/** The run of consecutive empty paragraphs around `paragraph` and the blocks bounding it. */
const emptyParagraphRun = (paragraph: Node) => {
	let before = siblingBlock(paragraph, "previousSibling");
	let index = 0;
	while (before && isEmptyParagraph(before)) {
		index += 1;
		before = siblingBlock(before, "previousSibling");
	}
	let after = siblingBlock(paragraph, "nextSibling");
	let length = index + 1;
	while (after && isEmptyParagraph(after)) {
		length += 1;
		after = siblingBlock(after, "nextSibling");
	}
	return { after, before, index, length };
};

/**
 * Inverse of renderTipTapHTML, which shows a blank source line between a details
 * section and a neighbouring paragraph or section as one empty editor line. In a
 * run of empty lines touching a section, one line is that blank line; the others
 * stay `&nbsp;` paragraphs. It counts only where the renderer recreates it: next
 * to a section whose other side is a paragraph or section after saving.
 */
const isSourceBlankLine = (paragraph: Node): boolean => {
	const { after, before, index, length } = emptyParagraphRun(paragraph);
	if (isElementNamed(before, "details") && (length > 1 || sharesLineFlow(after))) {
		return index === 0;
	}
	if (isElementNamed(after, "details") && (length > 1 || sharesLineFlow(before))) {
		return index === length - 1;
	}
	return false;
};

const processChildrenForMarkdoc = (
	node: Node,
	processNode: (childNode: Node) => string,
): string => {
	let innerContent = "";
	const blankLines = new Set<Node>();
	for (const child of node.childNodes) {
		if (isEmptyParagraph(child) && isSourceBlankLine(child)) {
			blankLines.add(child);
			continue;
		}
		// A details section directly next to a line block continues its lines:
		// no blank line between them in the source. Its opening tag always follows
		// the preceding block with one line break; an authored empty paragraph is
		// still serialized separately and therefore keeps an intentional gap.
		const previous = siblingBlock(child, "previousSibling");
		if (
			previous &&
			!blankLines.has(previous) &&
			(isElementNamed(child, "details") ||
				(isElementNamed(previous, "details") && sharesLineFlow(child)))
		) {
			innerContent = innerContent.replace(/\n+$/u, "\n");
		}
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
	if (node.nodeType === 3) {
		return node.textContent || "";
	}
	if (node.nodeType !== 1) {
		return "";
	}

	const element = node as Element;
	const tagName = element.tagName.toLowerCase();
	// ProseMirror's view-only filler is not an authored hard break.
	if (tagName === "br" && element.classList.contains("ProseMirror-trailingBreak")) {
		return "";
	}
	if (tagName === "table") {
		return renderTable(element, processNodeForMarkdoc);
	}
	const innerContent = processChildrenForMarkdoc(element, processNodeForMarkdoc);
	const customRenderer = customMarkdocRenderers[tagName];
	return customRenderer
		? customRenderer(element, innerContent)
		: renderHtmlElement(element, tagName, innerContent);
};

convertHtmlFragmentToMarkdoc = (htmlFragment: string): string => {
	if (htmlFragment.length === 0) {
		return "";
	}
	if (typeof DOMParser === "undefined") {
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
	if (!isHtmlToMarkdocSupported()) {
		throw new Error("htmlToMarkdoc requires a DOM environment with DOMParser support.");
	}

	const parser = new DOMParser();
	const doc = parser.parseFromString(html, "text/html");

	// Start processing from the body to skip implicit <html><head><body> tags
	// and handle potentially fragmented HTML inputs correctly.
	return processNodeForMarkdoc(doc.body);
};

/** Whether htmlToMarkdoc can run in the current JavaScript environment. */
export const isHtmlToMarkdocSupported = (): boolean => typeof DOMParser !== "undefined";
