import type { OcrProviderProtocol } from "@/lib/ocr-protocol";
import type { OcrPage, OcrResult } from "@/lib/ocr-types";
import type { OcrAdapter } from "@/orpc/scribe/ocr/adapter";
import { createLlmOcrAdapter } from "@/orpc/scribe/ocr/adapters/llm";
import type { LlmOcrUsageCallback } from "@/orpc/scribe/ocr/adapters/llm";
import { createMistralOcrAdapter } from "@/orpc/scribe/ocr/adapters/mistral";
import { createHttpOcrAdapter } from "@/orpc/scribe/ocr/adapters/ocr-http";
import { createPrivatemodeOcrAdapter } from "@/orpc/scribe/ocr/adapters/privatemode";
import { renderPageImages } from "@/orpc/scribe/ocr/render";
import { isOcrServiceSelection } from "@/orpc/scribe/providers";
import type { ResolvedOcrSelection, ResolvedOcrServiceSelection } from "@/orpc/scribe/providers";

/** Dedicated OCR providers by protocol. Vision LLMs share the LLM adapter. */
const OCR_SERVICE_ADAPTERS: Record<
	OcrProviderProtocol,
	(model: ResolvedOcrServiceSelection["model"]) => OcrAdapter
> = {
	"mistral-ocr": createMistralOcrAdapter,
	"ocr-http": createHttpOcrAdapter,
	"privatemode-ocr": createPrivatemodeOcrAdapter,
};

/** Selects the OCR engine for the configured document model. */
const createOcrAdapter = ({
	modelSelection,
	onModelUsage,
	userId,
	zdr,
}: {
	modelSelection: ResolvedOcrSelection;
	onModelUsage?: LlmOcrUsageCallback;
	userId: string;
	zdr?: boolean;
}): OcrAdapter => {
	if (isOcrServiceSelection(modelSelection)) {
		return OCR_SERVICE_ADAPTERS[modelSelection.model.providerProtocol](modelSelection.model);
	}
	return createLlmOcrAdapter({ modelSelection, onModelUsage, userId, zdr });
};

/**
 * The OCR entry point: takes a PDF or image and returns its text (Markdown with
 * HTML tables) plus optional citation boxes. Callers never depend on which
 * engine produced the result.
 */
export const extractOcrDocument = async ({
	data,
	mimeType,
	...adapterInput
}: {
	data: Buffer;
	mimeType: string;
	modelSelection: ResolvedOcrSelection;
	/** Called once per vision-model request so callers can log token usage. */
	onModelUsage?: LlmOcrUsageCallback;
	userId: string;
	zdr?: boolean;
}): Promise<OcrResult> => {
	const adapter = createOcrAdapter(adapterInput);
	if (adapter.kind === "document") {
		return adapter.recognizeDocument(data, mimeType);
	}
	const pages: OcrPage[] = [];
	const texts: string[] = [];
	try {
		// Sequential: bounds memory and provider concurrency for long PDFs.
		for await (const pageImage of renderPageImages(data, mimeType)) {
			const result = await adapter.recognizePage(pageImage);
			texts.push(result.text);
			if (result.page) {
				pages.push(result.page);
			}
		}
	} finally {
		adapter.close?.();
	}
	const text = texts.join("\n\f\n");
	return {
		backend: adapter.backend,
		// Citation geometry is all-or-nothing per document.
		...(pages.length === texts.length ? { pages } : {}),
		text: text.trim() ? text : "",
	};
};
