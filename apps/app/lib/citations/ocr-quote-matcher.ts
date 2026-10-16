import { normalizeCitationSearchText } from "markdoc-md/citations";

import type { OcrBlock, OcrPage, OcrResult } from "@/lib/ocr-types";

export type OcrCitationBounds = OcrBlock["bbox"];
export type OcrCitationDocument = Pick<OcrResult, "pages">;

export interface OcrQuoteMatch {
	bounds: OcrCitationBounds;
	pageHeight: number;
	pageNumber: number;
	pageWidth: number;
	quote: string;
	strategy: string;
}

interface OcrQuoteMatchRequest {
	document: OcrCitationDocument;
	normalizedQuote: string;
	quote: string;
}

export interface OcrQuoteMatchStrategy {
	find: (request: OcrQuoteMatchRequest) => OcrQuoteMatch | null;
	name: string;
}

const hasValidBounds = (bounds: OcrCitationBounds, page: OcrPage): boolean =>
	Number.isFinite(bounds.x) &&
	Number.isFinite(bounds.y) &&
	Number.isFinite(bounds.width) &&
	Number.isFinite(bounds.height) &&
	bounds.x >= 0 &&
	bounds.y >= 0 &&
	bounds.width > 0 &&
	bounds.height > 0 &&
	bounds.x + bounds.width <= page.width &&
	bounds.y + bounds.height <= page.height;

export const unionOcrCitationBounds = (
	bounds: readonly OcrCitationBounds[],
): OcrCitationBounds | null => {
	const [first] = bounds;
	if (!first) {
		return null;
	}

	let left = first.x;
	let top = first.y;
	let right = first.x + first.width;
	let bottom = first.y + first.height;
	for (const current of bounds.slice(1)) {
		left = Math.min(left, current.x);
		top = Math.min(top, current.y);
		right = Math.max(right, current.x + current.width);
		bottom = Math.max(bottom, current.y + current.height);
	}

	return { height: bottom - top, width: right - left, x: left, y: top };
};

const normalizeOcrText = (text: string): string =>
	normalizeCitationSearchText(
		text
			.replaceAll(/<\/?(?:table|thead|tbody|tfoot|tr|td|th|br)\b[^>]*>/gi, " ")
			.replaceAll(/(?<=\p{L})(?=\d)|(?<=\d)(?=\p{L})/gu, " ")
			.replaceAll(/(?<=[)%])(?=\d)/g, " ")
			.replaceAll(/(?<!\d):|:(?!\d)/g, " ")
			.replaceAll("|", " ")
			.replaceAll(/[“”„]/g, '"')
			.replaceAll(/[–—]/g, "-"),
	);

const indexOcrPage = (page: OcrPage) => {
	let text = "";
	// Follow visual reading order for table cells, but never move an invalid box
	// out of the text stream and thereby manufacture adjacency around it.
	const sourceBlocks = page.blocks.every((block) => hasValidBounds(block.bbox, page))
		? page.blocks.toSorted((left, right) =>
				Math.abs(left.bbox.y - right.bbox.y) <= Math.min(left.bbox.height, right.bbox.height) / 2
					? left.bbox.x - right.bbox.x
					: left.bbox.y - right.bbox.y,
			)
		: page.blocks;
	const blocks = sourceBlocks
		.map((block) => ({ ...block, normalizedText: normalizeOcrText(block.text) }))
		.filter((block) => block.normalizedText)
		.map((block) => {
			const start = text.length + (text ? 1 : 0);
			text += `${text ? " " : ""}${block.normalizedText}`;
			return { ...block, end: text.length, start };
		});
	return { blocks, text };
};

const isCompleteMatch = (text: string, start: number, end: number): boolean => {
	const word = /[\p{L}\p{N}]/u;
	return !(
		(word.test(text[start] ?? "") && word.test(text[start - 1] ?? "")) ||
		(word.test(text[end - 1] ?? "") && word.test(text[end] ?? "")) ||
		(/\d/.test(text[start] ?? "") && /(?:\d[.,]|[+-])$/.test(text.slice(0, start))) ||
		(/\d/.test(text[end - 1] ?? "") && /^[.,]\d/.test(text.slice(end)))
	);
};

/** Exact normalized matching, retaining source-item intervals like LiteParse's visual citations. */
const contiguousOcrBlocksStrategy: OcrQuoteMatchStrategy = {
	find: ({ document, normalizedQuote, quote }) => {
		const numericOnly = !/\p{L}/u.test(normalizedQuote);
		let numericMatch: OcrQuoteMatch | null = null;
		for (const page of document.pages ?? []) {
			if (!(page.width > 0 && page.height > 0 && page.pageNumber > 0)) {
				continue;
			}
			const { blocks, text: pageText } = indexOcrPage(page);

			let bestWindow: typeof blocks | undefined;
			let matchStart = pageText.indexOf(normalizedQuote);
			while (matchStart >= 0) {
				const matchOffset = matchStart;
				const matchEnd = matchStart + normalizedQuote.length;
				const window = blocks.filter(({ end, start }) => end > matchOffset && start < matchEnd);
				if (
					window.length > 0 &&
					isCompleteMatch(pageText, matchStart, matchEnd) &&
					window.every((block) => hasValidBounds(block.bbox, page))
				) {
					if (numericOnly && (bestWindow || numericMatch)) {
						return null;
					}
					if (!bestWindow || window.length < bestWindow.length) {
						bestWindow = window;
					}
				}
				matchStart = pageText.indexOf(normalizedQuote, matchStart + 1);
			}

			const bounds = unionOcrCitationBounds(bestWindow?.map((block) => block.bbox) ?? []);
			if (bounds) {
				const match = {
					bounds,
					pageHeight: page.height,
					pageNumber: page.pageNumber,
					pageWidth: page.width,
					quote,
					strategy: "contiguous-blocks",
				};
				if (!numericOnly) {
					return match;
				}
				numericMatch = match;
			}
		}

		return numericMatch;
	},
	name: "contiguous-blocks",
};

/** Exact label/cell pairs on the same visual row, even when another table interleaves the stream. */
const spatialOcrRowStrategy: OcrQuoteMatchStrategy = {
	find: ({ document, normalizedQuote, quote }) => {
		let match: OcrQuoteMatch | null = null;
		for (const page of document.pages ?? []) {
			if (!page.blocks.every((block) => hasValidBounds(block.bbox, page))) {
				return null;
			}
			const { blocks } = indexOcrPage(page);
			for (const label of blocks) {
				if (
					!/\p{L}/u.test(label.normalizedText) ||
					!normalizedQuote.startsWith(`${label.normalizedText} `)
				) {
					continue;
				}
				for (const cell of blocks) {
					const overlap =
						Math.min(label.bbox.y + label.bbox.height, cell.bbox.y + cell.bbox.height) -
						Math.max(label.bbox.y, cell.bbox.y);
					if (
						cell.bbox.x < label.bbox.x + label.bbox.width ||
						overlap < Math.min(label.bbox.height, cell.bbox.height) / 2 ||
						`${label.normalizedText} ${cell.normalizedText}` !== normalizedQuote
					) {
						continue;
					}
					const interrupted = blocks.some(
						(other) =>
							other !== label &&
							other !== cell &&
							other.bbox.x < cell.bbox.x &&
							other.bbox.x + other.bbox.width > label.bbox.x + label.bbox.width &&
							Math.min(label.bbox.y + label.bbox.height, other.bbox.y + other.bbox.height) -
								Math.max(label.bbox.y, other.bbox.y) >=
								Math.min(label.bbox.height, other.bbox.height) / 2,
					);
					if (interrupted) {
						continue;
					}
					if (match) {
						return null;
					}
					const bounds = unionOcrCitationBounds([label.bbox, cell.bbox]);
					if (bounds) {
						match = {
							bounds,
							pageHeight: page.height,
							pageNumber: page.pageNumber,
							pageWidth: page.width,
							quote,
							strategy: "spatial-row",
						};
					}
				}
			}
		}
		return match;
	},
	name: "spatial-row",
};

export const createOcrQuoteMatcher =
	(
		strategies: readonly OcrQuoteMatchStrategy[] = [
			contiguousOcrBlocksStrategy,
			spatialOcrRowStrategy,
		],
	) =>
	(document: OcrCitationDocument, quote: string): OcrQuoteMatch | null => {
		const trimmedQuote = quote.trim();
		const normalizedQuote = normalizeOcrText(trimmedQuote);
		if (!normalizedQuote) {
			return null;
		}

		for (const strategy of strategies) {
			const match = strategy.find({ document, normalizedQuote, quote: trimmedQuote });
			if (match) {
				return { ...match, strategy: strategy.name };
			}
		}

		return null;
	};

export const matchOcrQuote = createOcrQuoteMatcher();
