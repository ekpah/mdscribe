import type { Database } from "@repo/database";
import type { ModelMessage } from "ai";

import {
	formatAudioTranscriptsForPrompt,
	prepareAudioInputForModel,
	transcribeAudioFilesWithPrompt,
} from "@/orpc/scribe/handlers/audio-input";
import {
	createContextFileParts,
	extractContextFileText,
	formatContextFileMetadataForPrompt,
} from "@/orpc/scribe/handlers/context-file-input";
import {
	validateScribeAudioFiles,
	validateScribeContextFiles,
} from "@/orpc/scribe/handlers/media-limits";
import type {
	AudioPayloadSummary,
	ContextFilePayloadSummary,
} from "@/orpc/scribe/handlers/media-limits";
import type { AgentGenerationStrategy, MediaPlan } from "@/orpc/scribe/providers";
import type { AudioFile, FillInputsContextFile } from "@/orpc/scribe/types";

/**
 * AI SDK file part for native multimodal input. Shared by the prepared audio
 * recordings and the attached context files.
 */
interface PreparedFilePart {
	data: Buffer;
	filename?: string;
	mediaType: string;
	type: "file";
}

export interface PreparedAgentMedia {
	/** File parts attached natively to the standard model's user turn. */
	nativeContentParts: PreparedFilePart[];
	/** Text blocks (transcripts / extracted file text / metadata) injected as context. */
	injectedTextBlocks: string[];
	/** Audio transcripts produced by preprocessing. Empty when audio was native or absent. */
	audioTranscripts: string[];
	audioSummaries: AudioPayloadSummary[];
	/** Extracted text from preprocessed files. Empty when files were native or absent. */
	fileTextContext: string;
	fileSummaries: ContextFilePayloadSummary[];
	usedNativeAudio: boolean;
	usedTranscription: boolean;
	usedFilePreprocessing: boolean;
	audioMode?: string;
	fileMode?: string;
}

const EMPTY_PREPARED_MEDIA: PreparedAgentMedia = {
	audioSummaries: [],
	audioTranscripts: [],
	fileSummaries: [],
	fileTextContext: "",
	injectedTextBlocks: [],
	nativeContentParts: [],
	usedFilePreprocessing: false,
	usedNativeAudio: false,
	usedTranscription: false,
};

const describeMediaMode = (plan: MediaPlan<unknown> | undefined): string | undefined => {
	if (!plan) {
		return undefined;
	}
	return plan.mode === "native" ? "native" : `preprocess-${plan.strategy}`;
};

/**
 * Prepares the agent's per-turn audio/file attachments for the standard model.
 *
 * Reuses the shared scribe media pipeline: the document slot takes precedence
 * over native vision; audio uses native capability or speech-to-text. The
 * returned `nativeContentParts` are appended to the latest user turn while
 * `injectedTextBlocks` carry transcripts, structured OCR, and metadata.
 */
export const prepareAgentMedia = async ({
	audioFiles,
	contextFiles,
	db,
	strategy,
	userId,
	zdr,
}: {
	audioFiles: AudioFile[];
	contextFiles: FillInputsContextFile[];
	db: Database;
	strategy: AgentGenerationStrategy;
	userId: string;
	zdr: boolean;
}): Promise<PreparedAgentMedia> => {
	const hasAudio = audioFiles.length > 0;
	const hasFiles = contextFiles.length > 0;
	if (!(hasAudio || hasFiles)) {
		return EMPTY_PREPARED_MEDIA;
	}

	const audioSummaries = validateScribeAudioFiles(audioFiles);
	const fileSummaries = validateScribeContextFiles(contextFiles);

	const nativeContentParts: PreparedFilePart[] = [];
	const injectedTextBlocks: string[] = [];
	let audioTranscripts: string[] = [];
	let fileTextContext = "";
	let usedNativeAudio = false;
	let usedTranscription = false;
	let usedFilePreprocessing = false;

	const audioPlan = strategy.audio;
	if (hasAudio && audioPlan) {
		if (audioPlan.mode === "native") {
			const prepared = await prepareAudioInputForModel({
				audioFiles,
				db,
				mode: "native",
				resolvedModel: strategy.generation.model,
				userId,
				zdr,
			});
			nativeContentParts.push(...prepared.contentParts);
			usedNativeAudio = prepared.contentParts.length > 0;
		} else {
			if (audioPlan.strategy === "multimodal") {
				audioTranscripts = await transcribeAudioFilesWithPrompt({
					audioFiles,
					db,
					resolvedModel: audioPlan.selection.model,
					userId,
					zdr,
				});
			} else {
				({ transcripts: audioTranscripts } = await prepareAudioInputForModel({
					audioFiles,
					db,
					mode: "transcription",
					resolvedModel: audioPlan.selection.model,
					userId,
					zdr,
				}));
			}
			const transcriptBlock = formatAudioTranscriptsForPrompt(audioTranscripts);
			if (transcriptBlock) {
				injectedTextBlocks.push(transcriptBlock);
				usedTranscription = true;
			}
		}
	}

	const filesPlan = strategy.files;
	if (hasFiles && filesPlan) {
		if (filesPlan.mode === "native") {
			nativeContentParts.push(...createContextFileParts(contextFiles));
			const metadataBlock = formatContextFileMetadataForPrompt(contextFiles);
			if (metadataBlock) {
				injectedTextBlocks.push(metadataBlock);
			}
		} else {
			fileTextContext = await extractContextFileText({
				contextFiles,
				db,
				modelSelection: filesPlan.selection,
				userId,
				zdr,
			});
			if (fileTextContext) {
				injectedTextBlocks.push(fileTextContext);
				usedFilePreprocessing = true;
			}
		}
	}

	return {
		audioMode: describeMediaMode(audioPlan),
		audioSummaries,
		audioTranscripts,
		fileMode: describeMediaMode(filesPlan),
		fileSummaries,
		fileTextContext,
		injectedTextBlocks,
		nativeContentParts,
		usedFilePreprocessing,
		usedNativeAudio,
		usedTranscription,
	};
};

/**
 * Appends the prepared media to the latest user turn so the standard model sees
 * it alongside the instruction: injected transcripts/extracted text as a text
 * part, and native recordings/files as file parts. Earlier turns are left
 * untouched — attachments belong to the message that carried them.
 */
export const injectMediaIntoLastUserMessage = (
	messages: ModelMessage[],
	media: PreparedAgentMedia,
): ModelMessage[] => {
	if (media.injectedTextBlocks.length === 0 && media.nativeContentParts.length === 0) {
		return messages;
	}

	const lastIndex = messages.length - 1;
	const lastMessage = messages[lastIndex];
	if (!lastMessage || lastMessage.role !== "user") {
		return messages;
	}

	const baseParts =
		typeof lastMessage.content === "string"
			? [{ text: lastMessage.content, type: "text" as const }]
			: lastMessage.content;

	const injectedTextParts =
		media.injectedTextBlocks.length > 0
			? [{ text: media.injectedTextBlocks.join("\n\n"), type: "text" as const }]
			: [];

	const next = [...messages];
	next[lastIndex] = {
		...lastMessage,
		content: [...baseParts, ...injectedTextParts, ...media.nativeContentParts],
	} as ModelMessage;
	return next;
};
