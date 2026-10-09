import type { PrivatemodeAI } from "privatemode-ai";
import { z } from "zod";

import { OCR_MODEL_IDS } from "@/lib/ocr-protocol";
import type { OcrPage, OcrPageSource } from "@/lib/ocr-types";
import type { OcrAdapter, OcrPageResult } from "@/orpc/scribe/ocr/adapter";
import type { ResolvedOcrServiceSelection } from "@/orpc/scribe/providers";

export const createPrivatemodeOcrClient = async (
	apiKey: string | undefined,
	apiBaseURL: string,
) => {
	if (!apiKey) {
		throw new Error("Privatemode API key is required");
	}
	// Settings and other OCR engines must not eagerly load this optional SDK.
	const { PrivatemodeAI } = await import("privatemode-ai");
	return new PrivatemodeAI({
		apiBaseURL,
		apiKey,
		enableWasmLogging: false,
		openAIOptions: { maxRetries: 0, timeout: 120_000 },
	});
};

// DeepSeek-OCR-2 grounding uses XYXY on a 0..999 grid, not Gemini's YXYX/1000.
const boxesSchema = z
	.array(
		z
			.tuple([
				z.number().int().min(0).max(999),
				z.number().int().min(0).max(999),
				z.number().int().min(0).max(999),
				z.number().int().min(0).max(999),
			])
			.refine(([x1, y1, x2, y2]) => x2 > x1 && y2 > y1),
	)
	.max(5000);

export const parseDeepseekOcr = (raw: string, page: OcrPageSource): OcrPageResult => {
	const markers = [...raw.matchAll(/<\|ref\|>(.*?)<\|\/ref\|><\|det\|>(.*?)<\|\/det\|>/gs)];
	const text = raw
		.replaceAll(/<\|ref\|>.*?<\|\/ref\|><\|det\|>.*?<\|\/det\|>/gs, "")
		.replaceAll(/<\|(?:grounding|\/?ref|\/?det)\|>/g, "")
		.trim();
	const blocks: OcrPage["blocks"] = [];
	try {
		for (const [index, marker] of markers.entries()) {
			const content = raw
				.slice(marker.index + marker[0].length, markers[index + 1]?.index ?? raw.length)
				.trim();
			const boxes = boxesSchema.parse(JSON.parse(marker[2]));
			if (!content) {
				continue;
			}
			for (const [left, top, right, bottom] of boxes) {
				blocks.push({
					bbox: {
						height: ((bottom - top) * page.height) / 999,
						width: ((right - left) * page.width) / 999,
						x: (left * page.width) / 999,
						y: (top * page.height) / 999,
					},
					text: content,
					type: marker[1],
				});
			}
		}
	} catch {
		// Keep useful transcription, but never manufacture citation geometry.
		return { text };
	}
	return {
		text,
		...(blocks.length
			? {
					page: {
						blocks,
						height: page.height,
						pageNumber: page.pageNum,
						width: page.width,
					},
				}
			: {}),
	};
};

/** DeepSeek-OCR-2 through Privatemode's attested, end-to-end encrypted SDK. */
export const createPrivatemodeOcrAdapter = (
	model: ResolvedOcrServiceSelection["model"],
): OcrAdapter => {
	// One client per document: each new client repeats the enclave attestation.
	let client: PrivatemodeAI | undefined;
	return {
		backend: "privatemode-ocr",
		close: () => client?.close(),
		kind: "page",
		recognizePage: async ({ image, page }) => {
			client ??= await createPrivatemodeOcrClient(model.apiKey, model.endpoint);
			let response: Awaited<ReturnType<PrivatemodeAI["chat"]["completions"]["create"]>>;
			try {
				// The official SDK attests and encrypts lazily. Never fall back to raw HTTP.
				response = await client.chat.completions.create(
					{
						messages: [
							{
								content: [
									{
										image_url: { url: `data:image/jpeg;base64,${image.toString("base64")}` },
										type: "image_url",
									},
									{ text: "<|grounding|>Convert the document to markdown.", type: "text" },
								],
								role: "user",
							},
						],
						model: OCR_MODEL_IDS["privatemode-ocr"],
					},
					{ signal: AbortSignal.timeout(120_000) },
				);
			} catch {
				throw new Error("Die Privatemode-OCR-Anfrage ist fehlgeschlagen.");
			}
			const [choice] = response.choices;
			if (typeof choice?.message.content !== "string" || choice.finish_reason !== "stop") {
				// DeepSeek OCR cannot read sideways pages and runs into its output limit.
				throw new Error(
					"Privatemode-OCR lieferte kein vollständiges Ergebnis. Ist die Seite gedreht? Bild drehen und erneut versuchen.",
				);
			}
			return parseDeepseekOcr(choice.message.content, page);
		},
	};
};
