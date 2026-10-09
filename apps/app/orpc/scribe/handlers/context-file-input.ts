import { ORPCError } from "@orpc/server";
import type { Database } from "@repo/database";

import { getBase64Payload } from "@/lib/input-fill-limits";
import { ocrResultSchema } from "@/lib/ocr-types";
import type { OcrResult } from "@/lib/ocr-types";
import { AI_SCRIBE_OCR_EVENT_NAME } from "@/lib/usage-event-names";
import { USER_MESSAGES } from "@/lib/user-messages";
import { extractOcrDocument } from "@/orpc/scribe/ocr";
import { isOcrServiceSelection } from "@/orpc/scribe/providers";
import type { ResolvedOcrSelection } from "@/orpc/scribe/providers";
import type { FillInputsContextFile } from "@/orpc/scribe/types";

import { logMediaPreprocessingUsage } from "./preprocessing-usage";

interface PreparedContextFilePart {
	data: Buffer;
	mediaType: string;
	type: "file";
}

/**
 * Builds AI SDK file parts from browser-provided context files.
 *
 * The raw bytes are only used for the provider request. Usage events should
 * store file metadata separately instead of persisting these base64 payloads.
 */
export const createContextFileParts = (
	contextFiles: FillInputsContextFile[],
): PreparedContextFilePart[] =>
	contextFiles.map((file) => {
		if (file.kind === "ocr") {
			throw new ORPCError("BAD_REQUEST", {
				message: "Das Dokumenten-Modell wurde geändert. Bitte die Dateivorschau aktualisieren.",
			});
		}
		return {
			data: Buffer.from(getBase64Payload(file.data), "base64"),
			mediaType: file.mimeType,
			type: "file" as const,
		};
	});

/**
 * Formats attached file metadata for the prompt so direct multimodal models can
 * still see filenames and sizes, which AI SDK file parts do not carry.
 */
export const formatContextFileMetadataForPrompt = (
	contextFiles: FillInputsContextFile[],
): string => {
	if (contextFiles.length === 0) {
		return "";
	}

	const entries = contextFiles
		.map((file, index) =>
			file.kind === "ocr"
				? `<datei index="${index + 1}" name="${file.name}" />`
				: `<datei index="${index + 1}" name="${file.name}" mimeType="${file.mimeType}" size="${file.size}" />`,
		)
		.join("\n");

	return `<datei_metadaten>\n${entries}\n</datei_metadaten>`;
};

/**
 * Supplies indexed OCR text and citation geometry as JSON in Scribe's prompt.
 * Each document gets its own usage event so geometry has an unambiguous source.
 * Raw files and rendered page images are never included in usage events.
 */
export const extractContextFiles = async ({
	contextFiles,
	db,
	modelSelection,
	userId,
	zdr,
}: {
	contextFiles: FillInputsContextFile[] | undefined;
	db?: Database;
	modelSelection: ResolvedOcrSelection;
	userId: string;
	zdr?: boolean;
}): Promise<{ ocrResults: OcrResult[]; textContext: string }> => {
	if (!contextFiles?.length) {
		return { ocrResults: [], textContext: "" };
	}

	const ocrResults: OcrResult[] = [];
	const documents: { index: number; name: string; ocrResult: OcrResult }[] = [];
	// Bound document-level memory/concurrency, particularly for rasterized PDFs.
	for (const [index, file] of contextFiles.entries()) {
		if (file.kind === "ocr") {
			const result = ocrResultSchema.safeParse(file.ocrResult);
			if (!result.success || "data" in file) {
				throw new ORPCError("BAD_REQUEST", { message: "Das OCR-Ergebnis ist ungültig." });
			}
			ocrResults.push(result.data);
			documents.push({
				index: index + 1,
				name: file.name,
				ocrResult: result.data,
			});
			continue;
		}
		const data = Buffer.from(getBase64Payload(file.data), "base64");
		const requestStartedAt = Date.now();
		const inputData = {
			contextFiles: [
				{
					index: index + 1,
					mediaType: file.mimeType,
					name: file.name,
					payloadBytes: data.length,
					size: file.size,
				},
			],
		};
		const result = await extractOcrDocument({
			data,
			mimeType: file.mimeType,
			modelSelection,
			onModelUsage: (inference) => {
				if (isOcrServiceSelection(modelSelection)) {
					return;
				}
				logMediaPreprocessingUsage({
					db,
					inputData,
					isOpenRouter: modelSelection.model.isOpenRouter,
					metadata: {
						credentialSource: modelSelection.model.credentialSource,
						promptName: "ocr:llm-page",
						providerProtocol: modelSelection.model.providerProtocol,
						slot: "file-image",
					},
					modelName: modelSelection.model.modelName,
					name: AI_SCRIBE_OCR_EVENT_NAME,
					providerMetadata: inference.providerMetadata,
					result: inference.text,
					standardUsage: inference.usage,
					userId,
					zdr,
				});
			},
			userId,
			zdr,
		}).catch((error: unknown) => {
			const details = error instanceof Error ? error.message : USER_MESSAGES.unknownError;
			throw new ORPCError("BAD_REQUEST", {
				message: `Dateien konnten nicht analysiert werden. (${details})`,
			});
		});
		const promptName = "ocr:document";
		logMediaPreprocessingUsage({
			db,
			inputData,
			isOpenRouter: false,
			metadata: {
				endpoint: promptName,
				ocrBackend: result.backend,
				ocrModel: modelSelection.model.modelName,
				...(result.usage ? { billingUnit: "page", pagesProcessed: result.usage.pages } : {}),
				// Geometry contains source text too: ZDR must redact it, not just result.
				...(!zdr && result.pages
					? {
							ocr: { coordinateSystem: "page-relative-top-left", pages: result.pages },
						}
					: {}),
				promptLabel: promptName,
				promptName,
				slot: modelSelection.slot,
			},
			modelName: modelSelection.model.modelName,
			name: AI_SCRIBE_OCR_EVENT_NAME,
			result: result.text,
			timing: { timeToCompletionMs: Date.now() - requestStartedAt },
			userId,
			zdr,
		});
		ocrResults.push(result);
		documents.push({
			index: index + 1,
			name: file.name,
			ocrResult: result,
		});
	}
	return {
		ocrResults,
		textContext: documents.some(({ ocrResult }) => ocrResult.text)
			? `<datei_kontext>\n${JSON.stringify(documents)}\n</datei_kontext>`
			: "",
	};
};

export const extractContextFileText = async (
	input: Parameters<typeof extractContextFiles>[0],
): Promise<string> => {
	const result = await extractContextFiles(input);
	return result.textContext;
};
