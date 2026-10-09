import type { UIMessage } from "ai";
import { z } from "zod";

import { OCR_MODEL_IDS } from "@/lib/ocr-protocol";
import type { OcrProviderProtocol } from "@/lib/ocr-protocol";

/** Manually aligned page frame supplied to adapters, independent of the renderer. */
export interface OcrPageSource {
	pageNum: number;
	width: number;
	height: number;
}

/** Adapter-normalized citation region, never provider-specific pixel coordinates. */
interface OcrBlock {
	/** Page-relative coordinates: PDF points or image pixels, with top-left origin. */
	bbox: { height: number; width: number; x: number; y: number };
	text: string;
	type?: string;
}

export interface OcrPage {
	blocks: OcrBlock[];
	/** Dimensions and boxes describe the supplied, manually aligned page. */
	height: number;
	/** One-based page number in the original document. */
	pageNumber: number;
	width: number;
}

/**
 * Shared result for every OCR adapter. Preserve readable text/table markup
 * independently of citation geometry; consumers must not reflow text from boxes.
 * Adapters own provider response validation and coordinate normalization.
 */
export interface OcrResult {
	/** "llm" for vision models, otherwise the dedicated OCR provider protocol. */
	backend: "llm" | OcrProviderProtocol;
	/** Optional: a provider may produce useful text without reliable geometry. */
	pages?: OcrPage[];
	text: string;
	usage?: { pages: number };
}

/** Validate submitted OCR context structurally, not as proof of provider provenance. */
export const ocrResultSchema: z.ZodType<OcrResult> = z.object({
	backend: z.enum(["llm", ...Object.keys(OCR_MODEL_IDS)] as ["llm", ...OcrProviderProtocol[]]),
	pages: z
		.array(
			z.object({
				blocks: z.array(
					z.object({
						bbox: z.object({
							height: z.number().positive(),
							width: z.number().positive(),
							x: z.number().nonnegative(),
							y: z.number().nonnegative(),
						}),
						text: z.string(),
						type: z.string().optional(),
					}),
				),
				height: z.number().positive(),
				pageNumber: z.number().int().positive(),
				width: z.number().positive(),
			}),
		)
		.optional(),
	text: z.string(),
	usage: z.object({ pages: z.number().int().nonnegative() }).optional(),
});

/** Original bytes are used only for OCR upload or direct vision without a document model. */
export interface RawContextDocument {
	data: string;
	kind?: "file";
	mimeType: string;
	name: string;
	size: number;
}

/** Generation receives user-provided transcription and geometry, never image bytes. */
export interface OcrContextDocument {
	kind: "ocr";
	name: string;
	ocrResult: OcrResult;
}

export type ContextDocument = RawContextDocument | OcrContextDocument;

export type OcrUIMessage = UIMessage<unknown, { "ocr-results": OcrResult[] }>;
