import { ORPCError } from "@orpc/server";
import type { Database } from "@repo/database";
import { generateText } from "ai";

import { AI_SCRIBE_OCR_EVENT_NAME } from "@/lib/usage-event-names";
import type { StandardUsage } from "@/lib/usage-logging";
import { USER_MESSAGES } from "@/lib/user-messages";
import { buildProviderOptions } from "@/orpc/scribe/providers";
import type {
	MediaPreprocessStrategy,
	ResolvedDefaultModelSelection,
} from "@/orpc/scribe/providers";
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
	contextFiles.map((file) => ({
		data: Buffer.from(file.data, "base64"),
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
 * With strategy "multimodal" the files are sent together with an extraction
 * prompt. With strategy "direct" the files are sent without any text prompt,
 * which dedicated OCR models expect.
 */
export const extractContextFileText = async ({
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
}): Promise<string> => {
	if (!contextFiles?.length) {
		return "";
	}

	const messages =
		strategy === "direct"
			? [
					{
						content: createContextFileParts(contextFiles),
						role: "user" as const,
					},
				]
			: [
					{
						content:
							"Extrahiere den relevanten medizinischen Inhalt aus den angehängten Dateien. Antworte knapp, strukturiert und ohne erfundene Details.",
						role: "system" as const,
					},
					{
						content: [
							{
								text: "Dateien für medizinische Dokumentation:",
								type: "text" as const,
							},
							...createContextFileParts(contextFiles),
						],
						role: "user" as const,
					},
				];

	const requestStartedAt = Date.now();
	const result = await generateText({
		messages,
		model: modelSelection.model.model,
		providerOptions: buildProviderOptions({
			includeUsage: true,
			model: modelSelection.model,
			reasoningEffort: modelSelection.reasoningEffort,
			userId,
			zdr,
		}),
		temperature: 0.1,
	}).catch((error: unknown) => {
		const details =
			error instanceof Error ? error.message : USER_MESSAGES.unknownError;
		throw new ORPCError("BAD_REQUEST", {
			message: `Dateien konnten nicht analysiert werden. (${details})`,
		});
	});
	const timeToCompletionMs = Date.now() - requestStartedAt;

	const extractedText = result.text.trim();
	const promptName = strategy === "direct" ? "ocr:direct" : "ocr:prompt";
	await logMediaPreprocessingUsage({
		db,
		inputData: {
			contextFiles: contextFiles.map((file, index) => ({
				index: index + 1,
				mediaType: file.mimeType,
				name: file.name,
				payloadBytes: Buffer.from(file.data, "base64").length,
				size: file.size,
			})),
		},
		isOpenRouter: modelSelection.model.isOpenRouter,
		metadata: {
			endpoint: promptName,
			promptLabel: promptName,
			promptName,
			slot: modelSelection.slot,
			strategy,
		},
		modelName: modelSelection.model.modelName,
		name: AI_SCRIBE_OCR_EVENT_NAME,
		providerMetadata: (result as { providerMetadata?: Record<string, unknown> }).providerMetadata,
		result: extractedText,
		standardUsage: result.usage as StandardUsage,
		timing: { timeToCompletionMs },
		userId,
		zdr,
	});
	if (!extractedText) {
		return "";
	}

	return `<datei_kontext>\n${extractedText}\n</datei_kontext>`;
};
