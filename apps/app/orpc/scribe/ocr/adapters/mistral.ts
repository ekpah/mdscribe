import { z } from "zod";

import type { OcrResult } from "@/lib/ocr-types";
import type { OcrAdapter } from "@/orpc/scribe/ocr/adapter";
import type { ResolvedOcrServiceSelection } from "@/orpc/scribe/providers";

const blockSchema = z.object({
	bottom_right_x: z.number(),
	bottom_right_y: z.number(),
	content: z.string(),
	top_left_x: z.number(),
	top_left_y: z.number(),
	type: z.string(),
});
const responseSchema = z.object({
	pages: z
		.array(
			z.object({
				blocks: z.array(z.unknown()).nullish(),
				dimensions: z.object({
					dpi: z.number().positive(),
					height: z.number().positive(),
					width: z.number().positive(),
				}),
				index: z.number().int().nonnegative(),
				markdown: z.string(),
				tables: z
					.array(
						z.object({
							content: z.string().min(1),
							format: z.literal("html"),
							id: z.string().regex(/^tbl-\d+\.html$/),
						}),
					)
					.nullish(),
			}),
		)
		.min(1),
	usage_info: z.object({ pages_processed: z.number().int().positive() }),
});

const pageText = (page: z.infer<typeof responseSchema>["pages"][number]): string => {
	const tables = new Map<string, string>();
	for (const table of page.tables ?? []) {
		if (tables.has(table.id)) {
			throw new Error("Invalid Mistral OCR response");
		}
		tables.set(table.id, table.content);
	}
	const referenced = new Set<string>();
	// Replace provider placeholders in one pass, never in inserted HTML. Callback
	// replacement also preserves literal dollar signs and all rowspan/colspan markup.
	const text = page.markdown.replaceAll(
		/!?\[(tbl-\d+\.html)\]\(\1\)|(?<![\w./-])(tbl-\d+\.html)(?![\w./-])/g,
		(_match, linkId: string | undefined, bareId: string | undefined) => {
			const id = linkId ?? bareId ?? "";
			const content = tables.get(id);
			if (content === undefined) {
				throw new Error("Incomplete Mistral OCR response");
			}
			referenced.add(id);
			return content;
		},
	);
	// Preserve separately returned tables even if a provider omitted their marker.
	return [
		text,
		...[...tables].filter(([id]) => !referenced.has(id)).map(([, content]) => content),
	].join("\n\n");
};

const recognizeDocument = async (
	data: Buffer,
	mimeType: string,
	model: ResolvedOcrServiceSelection["model"],
): Promise<OcrResult> => {
	if (!model.apiKey) {
		throw new Error("Mistral OCR API key is missing");
	}
	if (mimeType !== "application/pdf" && !mimeType.startsWith("image/")) {
		throw new Error("Mistral OCR requires a PDF or image");
	}
	const url = `data:${mimeType};base64,${data.toString("base64")}`;
	const response = await fetch(`${model.endpoint.replace(/\/$/, "")}/ocr`, {
		body: JSON.stringify({
			document:
				mimeType === "application/pdf"
					? { document_url: url, type: "document_url" }
					: { image_url: url, type: "image_url" },
			include_blocks: true,
			include_image_base64: false,
			model: model.modelName,
			table_format: "html",
		}),
		headers: { Authorization: `Bearer ${model.apiKey}`, "Content-Type": "application/json" },
		method: "POST",
		signal: AbortSignal.timeout(120_000),
	});
	// Do not echo provider bodies: they can contain document content.
	if (response.status === 429) {
		throw new Error(
			"Mistral OCR hat die Anfrage wegen eines Anbieterlimits abgelehnt (HTTP 429). Bitte später erneut versuchen. Bei wiederholtem Auftreten die OCR-Limits des Mistral-Kontos prüfen.",
		);
	}
	if (!response.ok) {
		throw new Error(`Mistral OCR failed: HTTP ${response.status}`);
	}
	let body: unknown;
	try {
		body = await response.json();
	} catch {
		// JSON parser errors can include fragments of the document response too.
		throw new Error("Invalid Mistral OCR response");
	}
	const parsed = responseSchema.safeParse(body);
	if (!parsed.success) {
		throw new Error("Invalid Mistral OCR response");
	}
	const result = parsed.data;
	if (
		result.pages.length !== result.usage_info.pages_processed ||
		result.pages.some((page, index) => page.index !== index)
	) {
		throw new Error("Incomplete Mistral OCR response");
	}
	return {
		backend: "mistral-ocr",
		pages: result.pages.map((page) => {
			const scale = 72 / page.dimensions.dpi;
			return {
				blocks: (page.blocks ?? []).flatMap((raw) => {
					const checked = blockSchema.safeParse(raw);
					if (!checked.success) {
						return [];
					}
					const b = checked.data;
					if (
						b.top_left_x < 0 ||
						b.top_left_y < 0 ||
						b.bottom_right_x > page.dimensions.width ||
						b.bottom_right_y > page.dimensions.height ||
						b.bottom_right_x <= b.top_left_x ||
						b.bottom_right_y <= b.top_left_y
					) {
						return [];
					}
					return [
						{
							bbox: {
								height: (b.bottom_right_y - b.top_left_y) * scale,
								width: (b.bottom_right_x - b.top_left_x) * scale,
								x: b.top_left_x * scale,
								y: b.top_left_y * scale,
							},
							text: b.content,
							type: b.type,
						},
					];
				}),
				height: page.dimensions.height * scale,
				pageNumber: page.index + 1,
				width: page.dimensions.width * scale,
			};
		}),
		text: result.pages.map(pageText).join("\n\f\n"),
		usage: { pages: result.usage_info.pages_processed },
	};
};

/** Mistral OCR parses whole PDFs and images natively, so pages are not pre-rendered. */
export const createMistralOcrAdapter = (
	model: ResolvedOcrServiceSelection["model"],
): OcrAdapter => ({
	kind: "document",
	recognizeDocument: (data, mimeType) => recognizeDocument(data, mimeType, model),
});
