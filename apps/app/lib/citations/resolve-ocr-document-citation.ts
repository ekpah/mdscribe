import type { CitationDocumentLocation } from "markdoc-md/citations";

import type { OcrResult } from "@/lib/ocr-types";

import { matchOcrQuote } from "./ocr-quote-matcher";
import type { OcrQuoteMatch } from "./ocr-quote-matcher";
import { renderDocumentPage } from "./render-document-page";

type OcrQuoteMatcher = (document: OcrResult, quote: string) => OcrQuoteMatch | null;

interface ResolveOcrDocumentCitationOptions {
	locateQuote?: (file: File, quote: string, signal?: AbortSignal) => Promise<OcrQuoteMatch | null>;
	matcher?: OcrQuoteMatcher;
	ocrResult?: OcrResult;
	renderPage?: typeof renderDocumentPage;
	signal?: AbortSignal;
}

/** Documents without OCR boxes need the quote locator to highlight a citation. */
export const hasOcrBoxes = (ocrResult: OcrResult | undefined) =>
	Boolean(ocrResult?.pages?.some((page) => page.blocks.length > 0));

/** Reuse OCR boxes; only text-only documents need an on-demand quote locator. */
export const resolveOcrDocumentCitation = async (
	file: File,
	quote: string,
	{
		locateQuote,
		matcher = matchOcrQuote,
		ocrResult,
		renderPage = renderDocumentPage,
		signal,
	}: ResolveOcrDocumentCitationOptions = {},
): Promise<CitationDocumentLocation | null> => {
	signal?.throwIfAborted();
	try {
		const match =
			ocrResult && hasOcrBoxes(ocrResult)
				? matcher(ocrResult, quote)
				: await locateQuote?.(file, quote, signal);
		if (!match) {
			return null;
		}
		const imageBase64 = await renderPage(file, match.pageNumber, signal);
		signal?.throwIfAborted();
		return {
			bounds: match.bounds,
			imageBase64,
			pageHeight: match.pageHeight,
			pageNumber: match.pageNumber,
			pageWidth: match.pageWidth,
			quote: match.quote,
		};
	} catch (error) {
		signal?.throwIfAborted();
		if (error instanceof Error && error.name === "AbortError") {
			throw error;
		}
		return null;
	}
};
