import type { CitationLocator, CitationSource, PageBox, SourcePage } from "./types";

/** Visible text: tags removed, entities decoded, whitespace and case folded. */
const visible = (text: string) =>
	text
		.replaceAll(/<[^>]+>/gu, " ")
		.replaceAll("&lt;", "<")
		.replaceAll("&gt;", ">")
		.replaceAll("&nbsp;", " ")
		.replaceAll("&amp;", "&")
		.toLowerCase()
		.replaceAll(/\s+/gu, " ")
		.trim();

type Block = SourcePage["blocks"][number];

/**
 * Narrows an OCR block to the quoted table row, or to the quoted line(s) of a
 * paragraph estimated from character offsets and the page's typical line height.
 */
const narrow = (block: Block, quote: string, lineHeight: number): Block["bbox"] => {
	const { height, width, x, y } = block.bbox;
	if (block.text.includes("<tr")) {
		const rows = block.text.split("</tr>").filter((row) => /<t[dh]/u.test(row));
		const row = rows.findIndex((text) => visible(text).includes(quote));
		return row === -1
			? block.bbox
			: { height: height / rows.length, width, x, y: y + (height * row) / rows.length };
	}
	const text = visible(block.text);
	const lines = Math.max(1, Math.round(height / lineHeight));
	if (lines === 1) {
		return block.bbox;
	}
	const perLine = text.length / lines;
	const start = text.indexOf(quote);
	const end = start + quote.length;
	const first = Math.min(lines - 1, Math.floor(start / perLine));
	const last = Math.min(lines - 1, Math.floor((end - 1) / perLine));
	const lineBox = height / lines;
	return first === last
		? {
				height: lineBox,
				width: (width * (end - start)) / perLine,
				x: x + (width * (start - first * perLine)) / perLine,
				y: y + first * lineBox,
			}
		: { height: lineBox * (last - first + 1), width, x, y: y + first * lineBox };
};

const locateOnPages = (pages: SourcePage[], quote: string): CitationLocator | undefined => {
	const needle = visible(quote);
	if (!needle) {
		return undefined;
	}
	for (const page of pages) {
		// An exact block first: a bare "6" must not land inside "486".
		const block =
			page.blocks.find((candidate) => visible(candidate.text) === needle) ??
			page.blocks.find((candidate) => visible(candidate.text).includes(needle));
		if (!block) {
			continue;
		}
		const heights = page.blocks
			.filter((candidate) => !candidate.text.includes("<tr") && candidate.text.length < 60)
			.map((candidate) => candidate.bbox.height)
			.toSorted((a, b) => a - b);
		const bbox = narrow(
			block,
			needle,
			heights[Math.floor(heights.length / 2)] ?? block.bbox.height,
		);
		const box: PageBox = {
			height: bbox.height / page.height,
			width: bbox.width / page.width,
			x: bbox.x / page.width,
			y: bbox.y / page.height,
		};
		return { box, kind: "page", page: page.pageNumber };
	}
	return undefined;
};

/**
 * Where a quote sits: a character range of a text source, or a box on the OCR
 * page of an image or PDF. Undefined when the quote cannot be placed; the
 * quote stays the durable evidence and can be resolved again later.
 */
export const locateQuote = (source: CitationSource, quote: string): CitationLocator | undefined => {
	if (source.pages?.length) {
		return locateOnPages(source.pages, quote);
	}
	const start = source.text.indexOf(quote);
	return start === -1 ? undefined : { end: start + quote.length, kind: "text", start };
};
