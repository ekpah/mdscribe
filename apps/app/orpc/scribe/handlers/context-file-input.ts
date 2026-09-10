import type { Database } from "@repo/database";

import { getBase64Payload } from "@/lib/input-fill-limits";
import type { OcrResult } from "@/lib/ocr-types";
import { extractOcrDocument } from "@/orpc/scribe/ocr";
import type {
	MediaPreprocessStrategy,
	ResolvedDefaultModelSelection,
} from "@/orpc/scribe/providers";
import type { FillInputsContextFile } from "@/orpc/scribe/types";

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
	contextFiles.map((file) => ({
		data: Buffer.from(getBase64Payload(file.data), "base64"),
		mediaType: file.mimeType,
		type: "file" as const,
	}));

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
		.map(
			(file, index) =>
				`<datei index="${index + 1}" name="${file.name}" mimeType="${file.mimeType}" size="${file.size}" />`,
		)
		.join("\n");

	return `<datei_metadaten>\n${entries}\n</datei_metadaten>`;
};

/**
 * Extracts text from attached files with the configured file/image model.
 *
 * The returned text is passed into the final text model as normal prompt
 * context, keeping non-multimodal routes provider-agnostic and avoiding
 * implicit file support checks in the final generation model.
 *
 * Each file is extracted separately so its page geometry remains attributable
 * to the corresponding usage event. Only the text projection is passed on to
 * Scribe; consumers that need geometry should use `extractOcrDocument`.
 */
export const extractContextFiles = async ({
	contextFiles,
	db,
	modelSelection,
	strategy = "multimodal",
	userId,
	zdr,
}: {
	contextFiles: FillInputsContextFile[] | undefined;
	db?: Database;
	modelSelection: ResolvedDefaultModelSelection;
	strategy?: MediaPreprocessStrategy;
	userId: string;
	zdr?: boolean;
}): Promise<{ ocrResults: OcrResult[]; textContext: string }> => {
	if (!contextFiles?.length) {
		return { ocrResults: [], textContext: "" };
	}

	const results = [];
	for (const contextFile of contextFiles) {
		results.push(
			await extractOcrDocument({
				contextFile,
				db,
				modelSelection,
				strategy,
				userId,
				zdr,
			}),
		);
	}
	const extractedText = results
		.map((result) => result.text)
		.filter(Boolean)
		.join("\n\n");
	if (!extractedText) {
		return { ocrResults: results, textContext: "" };
	}

	return {
		ocrResults: results,
		textContext: `<datei_kontext>\n${extractedText}\n</datei_kontext>`,
	};
};

export const extractContextFileText = async (
	input: Parameters<typeof extractContextFiles>[0],
): Promise<string> => {
	const result = await extractContextFiles(input);
	return result.textContext;
};
