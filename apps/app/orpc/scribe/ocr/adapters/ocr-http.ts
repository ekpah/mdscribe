import { ocrHttpResponseSchema, validateOcrResponseBounds } from "@/lib/ocr-protocol";
import type { OcrAdapter } from "@/orpc/scribe/ocr/adapter";
import type { ResolvedOcrServiceSelection } from "@/orpc/scribe/providers";

/**
 * Self-hosted OCR services implementing the LiteParse HTTP protocol, such as
 * `services/paddleocr`. Native document markup is kept independently of the
 * line-level citation geometry.
 */
export const createHttpOcrAdapter = (model: ResolvedOcrServiceSelection["model"]): OcrAdapter => ({
	backend: "ocr-http",
	kind: "page",
	recognizePage: async ({ image, imageHeight, imageWidth, page }) => {
		const body = new FormData();
		body.append("file", new Blob([new Uint8Array(image)], { type: "image/jpeg" }), "page.jpg");
		body.append("language", "de");
		const response = await fetch(model.endpoint, {
			body,
			headers: model.apiKey ? { Authorization: `Bearer ${model.apiKey}` } : {},
			method: "POST",
			// Never forward page images and the bearer token to a redirect target.
			redirect: "error",
			signal: AbortSignal.timeout(120_000),
		})
			.then(async (res) => {
				if (!res.ok) {
					throw new Error(`HTTP ${res.status}`);
				}
				return validateOcrResponseBounds(
					ocrHttpResponseSchema.parse(await res.json()),
					imageWidth,
					imageHeight,
				);
			})
			.catch((error: unknown) => {
				// Log only the failure type: response bodies may contain document text.
				console.warn("OCR service request failed", {
					name: error instanceof Error ? error.name : "UnknownError",
					reason:
						error instanceof Error && error.message.startsWith("HTTP ") ? error.message : undefined,
				});
				throw new Error("Die OCR-Service-Anfrage ist fehlgeschlagen.");
			});
		// Pixel boxes refer to the supplied image; map them into the page frame.
		return {
			page: {
				blocks: response.results.map(({ bbox: [left, top, right, bottom], text }) => ({
					bbox: {
						height: ((bottom - top) * page.height) / imageHeight,
						width: ((right - left) * page.width) / imageWidth,
						x: (left * page.width) / imageWidth,
						y: (top * page.height) / imageHeight,
					},
					text,
				})),
				height: page.height,
				pageNumber: page.pageNum,
				width: page.width,
			},
			// No fake table reconstruction for legacy line-only endpoints.
			text: response.text ?? response.results.map((line) => line.text).join("\n"),
		};
	},
});
