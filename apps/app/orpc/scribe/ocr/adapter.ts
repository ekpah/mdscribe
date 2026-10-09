import type { OcrPage, OcrPageSource, OcrResult } from "@/lib/ocr-types";

/** One rendered page: an EXIF-corrected, size-bounded JPEG plus the original page frame. */
export interface OcrPageImage {
	image: Buffer;
	imageHeight: number;
	imageWidth: number;
	/** Boxes must be returned in this frame (PDF points or original image pixels). */
	page: OcrPageSource;
}

export interface OcrPageResult {
	/** Omitted when the engine returned no usable geometry. */
	page?: OcrPage;
	text: string;
}

/**
 * Contract for an OCR engine behind `extractOcrDocument`.
 *
 * - `page` adapters receive each page as a rendered image; the OCR module owns
 *   PDF rendering, EXIF orientation and payload size limits.
 * - `document` adapters receive the original PDF or image when the engine
 *   parses whole documents itself.
 *
 * Adapters own provider requests, response validation and normalizing boxes
 * into the page frame. Provider error details must not leak document content.
 */
export type OcrAdapter =
	| {
			backend: OcrResult["backend"];
			/** Releases per-document resources after the last page. */
			close?: () => void;
			kind: "page";
			recognizePage: (page: OcrPageImage) => Promise<OcrPageResult>;
	  }
	| {
			kind: "document";
			recognizeDocument: (data: Buffer, mimeType: string) => Promise<OcrResult>;
	  };
