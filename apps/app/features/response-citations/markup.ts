import { serializeCiteCitations } from "markdoc-md/citations";
import type { CitationRequest, CitationTextSource } from "markdoc-md/citations";

/** A marked span of the answer and every literal source excerpt supporting it. */
export interface ScribeCitation {
	/** Strongest excerpt first; e.g. a lab report and the note restating its value. */
	citations: (CitationRequest & { quote: string })[];
	end: number;
	start: number;
}

export interface ScribeCitationSource extends CitationTextSource {
	source: string;
}

const removeBlockDelimiters = (text: string, removed: Uint8Array): void => {
	const remove = (start: number, end: number) => removed.fill(1, start, end);
	let fence: { character: string; length: number } | undefined;
	let paragraph = false;
	let list = false;
	for (const match of text.matchAll(/[^\n]*(?:\n|$)/gu)) {
		const [line] = match;
		if (!line) {
			continue;
		}
		const start = match.index;
		const delimiter = /^ {0,3}(`{3,}|~{3,})([^\r\n]*)/u.exec(line);
		if (
			fence &&
			!line.endsWith("\n") &&
			/^ {0,3}(`{1,2}|~{1,2})\s*$/u.test(line) &&
			line.trim()[0] === fence.character
		) {
			remove(start, start + line.length);
			continue;
		}
		if (
			delimiter &&
			(fence
				? delimiter[1][0] === fence.character &&
					delimiter[1].length >= fence.length &&
					!delimiter[2].trim()
				: delimiter[1][0] !== "`" || !delimiter[2].includes("`"))
		) {
			fence = fence ? undefined : { character: delimiter[1][0], length: delimiter[1].length };
			// Keep the line break, so facts on either side cannot be concatenated.
			remove(start, start + line.replace(/[\r\n]+$/u, "").length);
			paragraph = false;
			continue;
		}
		if (/^ {0,3}(?:[-+*]|\d+[.)])\s/u.test(line)) {
			list = true;
		} else if (/^\S/u.test(line)) {
			list = false;
		}
		// Do not flatten list continuations or indentation inside ordinary paragraphs.
		const indent = /^(?: {4}|\t)+/u.exec(line);
		if (indent && !list && (!paragraph || fence)) {
			remove(start, start + indent[0].length);
		} else {
			paragraph = Boolean(line.trim());
		}
	}
};

const removeInlineDelimiters = (text: string, removed: Uint8Array): Set<number> => {
	const literal = new Set<number>();
	const remove = (start: number, end: number) => removed.fill(1, start, end);
	// Paired runs are inline-code delimiters. An unmatched run is an unfinished
	// streamed opener; drop it now rather than flashing a code marker to the user.
	for (let index = 0; index < text.length; index += 1) {
		if (removed[index] || text[index] !== "`") {
			continue;
		}
		let escapes = 0;
		for (let previous = index - 1; text[previous] === "\\"; previous -= 1) {
			escapes += 1;
		}
		if (escapes % 2) {
			continue;
		}
		let end = index + 1;
		while (text[end] === "`") {
			end += 1;
		}
		const run = text.slice(index, end);
		let closing = end;
		while ((closing = text.indexOf(run, closing)) !== -1) {
			if (!removed[closing] && text[closing - 1] !== "`" && text[closing + run.length] !== "`") {
				break;
			}
			closing += run.length;
		}
		remove(index, end);
		if (closing === -1) {
			index = end - 1;
		} else {
			// A different-length run inside a span is clinical content, not a
			// delimiter. Escape it so removing the outer run cannot create code.
			for (let inner = end; inner < closing; inner += 1) {
				if (text[inner] === "`") {
					literal.add(inner);
				}
			}
			remove(closing, closing + run.length);
			index = closing + run.length - 1;
		}
	}
	return literal;
};

/** Normalize the draft, not the generated tags: attribute strings are opaque data. */
const presentationDraft = (text: string): { offsets: number[]; text: string } => {
	const removed = new Uint8Array(text.length);
	removeBlockDelimiters(text, removed);
	const literal = removeInlineDelimiters(text, removed);
	const offsets = [0];
	let normalized = "";
	for (let index = 0; index < text.length; index += 1) {
		if (!removed[index]) {
			normalized += literal.has(index) ? `\\${text[index]}` : text[index];
		}
		offsets.push(normalized.length);
	}
	return { offsets, text: normalized };
};

/** Offsets always refer to the original answer, never previously inserted tags. */
export const addScribeCitations = (text: string, citations: readonly ScribeCitation[]): string => {
	const draft = presentationDraft(text);
	let result = draft.text;
	for (const citation of citations.toSorted((a, b) => b.start - a.start)) {
		const start = draft.offsets[citation.start];
		const end = draft.offsets[citation.end];
		result = `${result.slice(
			0,
			start,
		)}{% cite ${serializeCiteCitations(citation.citations)} %}${draft.text.slice(
			start,
			end,
		)}{% /cite %}${result.slice(end)}`;
	}
	return result;
};
