import type { CitationDocumentLocation } from "markdoc-md/citations";

import type { OcrResult } from "@/lib/ocr-types";

import { matchOcrQuote } from "./ocr-quote-matcher";
import type { OcrQuoteMatch } from "./ocr-quote-matcher";
import { renderDocumentPage } from "./render-document-page";

type OcrQuoteMatcher = (document: OcrResult, quote: string) => OcrQuoteMatch | null;

interface ResolveOcrDocumentCitationOptions {
	matcher?: OcrQuoteMatcher;
	ocrResult?: OcrResult;
	renderPage?: typeof renderDocumentPage;
	signal?: AbortSignal;
}

/** Reuse the submitted OCR boxes; without a match the original source stays available. */
export const resolveOcrDocumentCitation = async (
	file: File,
	quote: string,
	{
		matcher = matchOcrQuote,
		ocrResult,
		renderPage = renderDocumentPage,
		signal,
	}: ResolveOcrDocumentCitationOptions = {},
): Promise<CitationDocumentLocation | null> => {
	signal?.throwIfAborted();
	try {
		const match = ocrResult ? matcher(ocrResult, quote) : null;
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
