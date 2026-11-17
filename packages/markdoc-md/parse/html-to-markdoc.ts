/**
 * Converts Markdoc tags to HTML format using custom elements that can be used with Tiptap.
 * Supports cite, details, info, switch, and case tags.
 */

import { serializeCiteCitations } from "../citations/cite-attributes";
import type { CitationRequest } from "../citations/resolvers/types";
import { serializeMarkdocTable } from "./serialize-markdoc-table";

// Entity-only lines survive Markdown parsing, unlike empty lines and padding
// before/after consecutive or boundary hard breaks.
const EMPTY_LINE = "&nbsp;";
const HARD_BREAK = "  \n";

type LineFlowItem =
	| { kind: "line" | "details"; text: string }
	| { kind: "empty" }
	| { kind: "block"; text: string };

/**
 * Inverse of the rendered line flow, which shows a blank source line between two
 * line blocks as one empty line. Adjacent lines form one paragraph (sections
 * join without a blank line), a single empty line is a paragraph break, and
 * every line of longer or boundary runs stays an explicit `&nbsp;` paragraph.
 */
const serializeLineFlow = (items: LineFlowItem[]): string => {
	let markdoc = "";
	let previous: "line" | "details" | undefined;
	let emptyLines = 0;
	const emptyParagraphs = () => `${EMPTY_LINE}\n\n`.repeat(emptyLines);
	for (const item of items) {
		if (item.kind === "empty") {
			emptyLines += 1;
			continue;
		}
		if (item.kind === "block") {
			// Block tags such as a top-level switch end on their closing tag.
			markdoc += `${previous ? "\n\n" : ""}${emptyParagraphs()}${item.text.replace(/\n*$/u, "\n\n")}`;
			previous = undefined;
			emptyLines = 0;
			continue;
		}
		if (!previous) {
			// A section's opening tag follows a preceding block with one line break.
			markdoc =
				item.kind === "details" && emptyLines === 0 && markdoc
					? markdoc.replace(/\n+$/u, "\n")
					: markdoc + emptyParagraphs();
		} else if (emptyLines === 0) {
			markdoc += previous === "line" && item.kind === "line" ? HARD_BREAK : "\n";
		} else {
			markdoc += `\n\n${emptyLines === 1 ? "" : emptyParagraphs()}`;
		}
		markdoc += item.text;
		previous = item.kind;
		emptyLines = 0;
	}
	return `${markdoc}${previous ? "\n\n" : ""}${emptyParagraphs()}`;
};

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
	strong: (innerContent) => `**${innerContent}**`,
};

const preserveEmptyLines = (content: string): string => {
	const lines = content.split("\n");
	return lines
		.map((line, index) =>
			line.trim() ? line : `${EMPTY_LINE}${index < lines.length - 1 ? "  " : ""}`,
		)
		.join("\n");
};

const quoteMarkdocValue = (value: string): string => JSON.stringify(value);

const readAttribute = (element: Element, name: string): string | null =>
	element.getAttribute(name) ?? element.getAttribute(name.toLowerCase());

const serializeStringAttribute = (name: string, value: string | null): string =>
	value ? ` ${name}=${quoteMarkdocValue(value)}` : "";

/**
 * A cite's JSON-encoded `citations` list becomes a native Markdoc array again.
 * Anything else stays a string attribute, so validation still reports it.
 */
const serializeCitationsAttribute = (value: string): string => {
	let entries: unknown;
	try {
		entries = JSON.parse(value);
	} catch {
		return `citations=${quoteMarkdocValue(value)}`;
	}
	const isEntry = (entry: unknown): entry is CitationRequest =>
		typeof entry === "object" &&
		entry !== null &&
		typeof (entry as CitationRequest).source === "string" &&
		["string", "undefined"].includes(typeof (entry as CitationRequest).quote);
	return Array.isArray(entries) && entries.every(isEntry)
		? serializeCiteCitations(entries)
		: `citations=${quoteMarkdocValue(value)}`;
};

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

/** Writes one editor element, given its already converted content, as Markdoc. */
export type HtmlToMarkdocRenderer = (element: Element, innerContent: string) => string;

/** Renderers for a host's own tags, keyed by lowercase element name; set for one conversion. */
let hostRenderers: Partial<Record<string, HtmlToMarkdocRenderer>> = {};

const customMarkdocRenderers: Partial<Record<string, HtmlToMarkdocRenderer>> = {
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
		const citations = readAttribute(element, "citations");
		if (citations !== null) {
			return `{% cite ${serializeCitationsAttribute(citations)} %}${innerContent}{% /cite %}`;
		}
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

/**
 * An item's paragraphs and nested lists stay inside it: continuation lines are
 * indented to the content of the marker, without blank lines between them.
 */
const renderListItem = (element: Element, innerContent: string): string => {
	const marker = element.parentElement?.tagName.toLowerCase() === "ol" ? "1. " : "- ";
	const indent = " ".repeat(marker.length);
	const lines = innerContent
		.trim()
		.replaceAll(/\n{2,}/gu, "\n")
		.split("\n");
	return `${marker}${lines.join(`\n${indent}`)}\n`;
};

/** A nested list starts on its own line, also right after its item's text. */
const renderList = (element: Element, innerContent: string): string =>
	isElementNamed(element.parentElement, "li") ? `\n${innerContent}` : `${innerContent}\n`;

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
	return serializeMarkdocTable(
		rows.map((row) =>
			[...row.cells].map((cell) => {
				const paragraph =
					cell.children.length === 1 && cell.firstElementChild?.tagName === "P"
						? cell.firstElementChild
						: cell;
				return {
					colspan: Number(cell.getAttribute("colspan")),
					content: preserveEmptyLines([...paragraph.childNodes].map(processNode).join("")),
					rowspan: Number(cell.getAttribute("rowspan")),
				};
			}),
		),
		hasHeader,
	);
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
	ol: renderList,
	pre: (_element, innerContent) => `\`\`\`\n${innerContent}\n\`\`\`\n\n`,
	span: (_element, innerContent) => innerContent,
	ul: renderList,
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

const isLineBlock = (node: Node): boolean =>
	isElementNamed(node, "p") || isElementNamed(node, "details");

const toLineFlowItems = (
	child: Node,
	processChildren: (node: Node) => string,
	processNode: (node: Node) => string,
): LineFlowItem[] => {
	if (isElementNamed(child, "p")) {
		return processChildren(child)
			.split(HARD_BREAK)
			.map((line) => (line.trim() ? { kind: "line", text: line } : { kind: "empty" }));
	}
	if (isElementNamed(child, "details")) {
		return [{ kind: "details", text: processNode(child).replace(/\n+$/u, "") }];
	}
	// Formatting whitespace between block elements is not content.
	if (child.nodeType === 3 && !child.textContent?.trim()) {
		return [];
	}
	return [{ kind: "block", text: processNode(child) }];
};

const processChildrenForMarkdoc = (
	node: Node,
	processNode: (childNode: Node) => string,
): string => {
	const children = [...node.childNodes];
	if (!children.some(isLineBlock)) {
		return children.map(processNode).join("");
	}
	const processChildren = (child: Node) => processChildrenForMarkdoc(child, processNode);
	return serializeLineFlow(
		children.flatMap((child) => toLineFlowItems(child, processChildren, processNode)),
	);
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
	const customRenderer = hostRenderers[tagName] ?? customMarkdocRenderers[tagName];
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
export const htmlToMarkdoc = (
	html: string,
	options: {
		/**
		 * Writes elements of tags a host adds to the config, keyed by lowercase
		 * element name, e.g. `{ badge: (element, content) => … }`. They also apply
		 * inside switch and condition cases.
		 */
		renderers?: Partial<Record<string, HtmlToMarkdocRenderer>>;
	} = {},
): string => {
	if (!isHtmlToMarkdocSupported()) {
		throw new Error("htmlToMarkdoc requires a DOM environment with DOMParser support.");
	}

	const parser = new DOMParser();
	const doc = parser.parseFromString(html, "text/html");

	// The conversion is synchronous, so the host renderers hold for exactly this call.
	const previousRenderers = hostRenderers;
	hostRenderers = options.renderers ?? {};
	try {
		// Start processing from the body to skip implicit <html><head><body> tags
		// and handle potentially fragmented HTML inputs correctly.
		return processNodeForMarkdoc(doc.body);
	} finally {
		hostRenderers = previousRenderers;
	}
};

/** Whether htmlToMarkdoc can run in the current JavaScript environment. */
export const isHtmlToMarkdocSupported = (): boolean => typeof DOMParser !== "undefined";
