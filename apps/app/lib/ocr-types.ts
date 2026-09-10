import type { UIMessage } from "ai";

export interface OcrBlock {
	bbox: { height: number; width: number; x: number; y: number };
	text: string;
}

export interface OcrPage {
	blocks: OcrBlock[];
	height: number;
	pageNumber: number;
	width: number;
}

export interface OcrResult {
	backend: "llm" | "ocr-http";
	pages?: OcrPage[];
	text: string;
}

export type OcrUIMessage = UIMessage<unknown, { "ocr-results": OcrResult[] }>;
