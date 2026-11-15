import { parse } from "@markdoc/markdoc";
import type { Node } from "@markdoc/markdoc";
import { parseCitationSource } from "markdoc-md/citations";

import { formatOcrTextForPrompt } from "../../lib/ocr-prompt-text";
import { splitSentences } from "./claims";
import type { CitationSource } from "./types";

// Read syntax only. Never transform/evaluate document tags or their attributes.
export const visibleText = (node: Node): string => {
	if (node.type === "text") {
		return String(node.attributes.content ?? "");
	}
	if (node.type === "softbreak" || node.type === "hardbreak") {
		return "\n";
	}
	return node.children
		.map(visibleText)
		.join(["tr", "list", "table"].includes(node.type) ? "\n" : "");
};

/**
 * One passage per line, list item or table row. `text` is what a model reads;
 * `quote` is the literal excerpt a citation stores (text sources keep their markup).
 */
export const collectPassages = (sources: readonly Pick<CitationSource, "source" | "text">[]) => {
	const evidence: { source: string; quote: string; text: string }[] = [];
	for (const { source, text: original } of sources) {
		const text = formatOcrTextForPrompt(original);
		const lines = text.split("\n");
		const isInput = parseCitationSource(source).kind === "input";
		const push = (visible: string, quote: string) => {
			if (visible.trim() && quote.trim() && quote.length <= 4000) {
				evidence.push({ quote: quote.trim(), source, text: visible.trim() });
			}
		};
		// Text sources are displayed verbatim, unlike OCR's rendered document.
		// Retain their literal markup so the existing exact resolver can highlight it.
		const literal = (node: Node) =>
			isInput && original === text && node.location
				? lines.slice(node.location.start.line, node.location.end.line)
				: undefined;
		const visit = (node: Node) => {
			if (node.type === "tr") {
				const visible = visibleText(node);
				const quote = isInput ? literal(node)?.join("\n") : visible;
				if (quote !== undefined) {
					push(visible, quote);
				}
				return;
			}
			// Paragraph, heading and list-item text. One passage per line keeps
			// citations short.
			if (node.type === "inline") {
				const visible = visibleText(node).split("\n");
				const quotes = isInput ? literal(node) : visible;
				if (quotes?.length === visible.length) {
					for (const [index, line] of visible.entries()) {
						push(line, quotes[index]);
					}
				} else if (quotes) {
					push(visible.join("\n"), quotes.join("\n"));
				}
				return;
			}
			for (const child of node.children) {
				visit(child);
			}
		};
		visit(parse(text));
	}
	return evidence;
};

export interface Passage {
	id: string;
	label: string;
	source: string;
	/** What the decision model and retrieval read. */
	text: string;
	/** Literal excerpts a citation quotes: one, or a form label and its value. */
	quotes: string[];
}

/** Short blocks without words, such as a handwritten "52/26 (36)" or "4.78". */
const isBareValue = (text: string) => text.length <= 14 && !/[a-zäöüß]{3,}/iu.test(text);
/** Longer passages are split into sentences so a quote is one finding, not a whole report. */
const MAX_PASSAGE_LENGTH = 200;

/**
 * Evidence passages of all sources. Table rows carry their header row, a bare
 * value on a form is joined with the label block before it, and long OCR
 * paragraphs become sentences.
 */
export const buildPassages = (sources: readonly CitationSource[]): Passage[] => {
	const labels = new Map(sources.map((source) => [source.source, source.label]));
	const raw = collectPassages(sources).map((passage) => ({
		label: labels.get(passage.source) ?? "",
		quotes: [passage.quote],
		source: passage.source,
		text: passage.text.replaceAll("\n", " | "),
	}));
	const passages: Omit<Passage, "id">[] = [];
	let header: string | null = null;
	for (const [index, passage] of raw.entries()) {
		const previous = raw[index - 1];
		const sameSource = previous?.source === passage.source;
		const isRow = passage.text.includes(" | ");
		if (!isRow) {
			header = null;
		} else if (!sameSource || !previous?.text.includes(" | ")) {
			header = passage.text;
		}
		if (isRow && header && header !== passage.text) {
			passages.push({ ...passage, text: `[${header}] ${passage.text}` });
		} else if (previous && sameSource && isBareValue(passage.text) && !isBareValue(previous.text)) {
			passages.push({
				...passage,
				quotes: [...previous.quotes, ...passage.quotes],
				text: `${previous.text}: ${passage.text}`,
			});
		} else if (passage.text.length > MAX_PASSAGE_LENGTH && passage.quotes[0] === passage.text) {
			for (const sentence of splitSentences(passage.text, 0)) {
				passages.push({ ...passage, quotes: [sentence.text], text: sentence.text });
			}
		} else {
			passages.push(passage);
		}
	}
	return passages.map((passage, index) => ({ ...passage, id: `p${index}` }));
};
