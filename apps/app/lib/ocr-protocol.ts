import { z } from "zod";

export const OCR_MODEL_IDS = {
	"mistral-ocr": "mistral-ocr-4-0",
	"ocr-http": "ocr",
	"privatemode-ocr": "deepseek-ocr-2",
} as const;

export type OcrProviderProtocol = keyof typeof OCR_MODEL_IDS;

export const isOcrProvider = (protocol: string): protocol is OcrProviderProtocol =>
	Object.hasOwn(OCR_MODEL_IDS, protocol);

const ocrBoxSchema = z
	.array(z.number().nonnegative())
	.length(4)
	.refine(([left, top, right, bottom]) => right > left && bottom > top, "Invalid OCR box");

/** LiteParse HTTP: pixel XYXY, not page-point XYWH. */
export const ocrHttpResponseSchema = z.object({
	results: z.array(
		z.object({
			bbox: ocrBoxSchema,
			confidence: z.number().min(0).max(1),
			text: z.string(),
		}),
	),
	/** Legacy services may report zero; automatic page correction is unsupported. */
	rotation: z.literal(0).optional(),
	/** Native Markdown/HTML. Absent only for legacy line-only OCR servers. */
	text: z.string().optional(),
});

export type OcrHttpResponse = z.infer<typeof ocrHttpResponseSchema>;

export const validateOcrResponseBounds = (
	response: OcrHttpResponse,
	width: number,
	height: number,
) => {
	if (response.results.some(({ bbox }) => bbox[2] > width || bbox[3] > height)) {
		throw new Error("OCR boxes exceed the page image");
	}
	return response;
};
