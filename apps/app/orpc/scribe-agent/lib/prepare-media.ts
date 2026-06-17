import { ORPCError } from "@orpc/server";
import type { Database } from "@repo/database";

import {
	FILL_INPUT_PAYLOAD_LIMITS,
	formatPayloadBytes,
	getBase64DecodedByteLength,
} from "@/lib/input-fill-limits";
import { USER_MESSAGES } from "@/lib/user-messages";
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
import { resolveAgentGenerationStrategy } from "@/orpc/scribe/providers";
import type { MediaPlan } from "@/orpc/scribe/providers";
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

interface AgentAudioPayloadSummary {
	index: number;
	mediaType: string;
	totalBytes: number;
}

interface AgentFilePayloadSummary {
	index: number;
	mediaType: string;
	name: string;
	payloadBytes: number;
	size: number;
}

export interface PreparedAgentMedia {
	/** File parts attached natively to the standard model's user turn. */
	nativeContentParts: PreparedFilePart[];
	/** Text blocks (transcripts / extracted file text / metadata) injected as context. */
	injectedTextBlocks: string[];
	/** Audio transcripts produced by preprocessing. Empty when audio was native or absent. */
	audioTranscripts: string[];
	audioSummaries: AgentAudioPayloadSummary[];
	/** Extracted text from preprocessed files. Empty when files were native or absent. */
	fileTextContext: string;
	fileSummaries: AgentFilePayloadSummary[];
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

const describeMediaMode = (plan: MediaPlan | undefined): string | undefined => {
	if (!plan) {
		return undefined;
	}
	return plan.mode === "native" ? "native" : `preprocess-${plan.strategy}`;
};

const throwLimit = (message: string): never => {
	throw new ORPCError("BAD_REQUEST", { message });
};

const assertAtMost = (value: number, limit: number, message: string) => {
	if (value > limit) {
		throwLimit(message);
	}
};

/**
 * Validates the per-turn audio/file payload against the shared input-fill
 * limits. Mirrors the media portion of the fill-inputs validation so the agent
 * enforces the same ceilings as the rest of the scribe flow.
 */
const validateAgentMediaPayload = (
	audioFiles: AudioFile[],
	contextFiles: FillInputsContextFile[],
): { audioSummaries: AgentAudioPayloadSummary[]; fileSummaries: AgentFilePayloadSummary[] } => {
	assertAtMost(
		audioFiles.length,
		FILL_INPUT_PAYLOAD_LIMITS.maxAudioFiles,
		`Maximal ${FILL_INPUT_PAYLOAD_LIMITS.maxAudioFiles} Audioaufnahmen können berücksichtigt werden.`,
	);
	assertAtMost(
		contextFiles.length,
		FILL_INPUT_PAYLOAD_LIMITS.maxContextFiles,
		`Maximal ${FILL_INPUT_PAYLOAD_LIMITS.maxContextFiles} Dateien können berücksichtigt werden.`,
	);

	const audioSummaries: AgentAudioPayloadSummary[] = [];
	let audioTotalBytes = 0;
	for (const [index, audioFile] of audioFiles.entries()) {
		const totalBytes =
			getBase64DecodedByteLength(audioFile.data) +
			getBase64DecodedByteLength(audioFile.wavFallback?.data);
		audioTotalBytes += totalBytes;
		assertAtMost(
			totalBytes,
			FILL_INPUT_PAYLOAD_LIMITS.maxAudioPayloadBytesPerRecording,
			`Audioaufnahme ${index + 1} ist zu groß. Maximal erlaubt sind ${formatPayloadBytes(FILL_INPUT_PAYLOAD_LIMITS.maxAudioPayloadBytesPerRecording)} pro Aufnahme.`,
		);
		audioSummaries.push({ index: index + 1, mediaType: audioFile.mimeType, totalBytes });
	}
	assertAtMost(
		audioTotalBytes,
		FILL_INPUT_PAYLOAD_LIMITS.maxAudioPayloadBytesTotal,
		`Die Audioaufnahmen sind zusammen zu groß. Maximal erlaubt sind ${formatPayloadBytes(FILL_INPUT_PAYLOAD_LIMITS.maxAudioPayloadBytesTotal)}.`,
	);

	const fileSummaries: AgentFilePayloadSummary[] = [];
	let fileTotalBytes = 0;
	for (const [index, file] of contextFiles.entries()) {
		const payloadBytes = getBase64DecodedByteLength(file.data);
		fileTotalBytes += payloadBytes;
		assertAtMost(
			payloadBytes,
			FILL_INPUT_PAYLOAD_LIMITS.maxContextFileBytes,
			`Die Datei "${file.name}" ist zu groß. Maximal erlaubt sind ${formatPayloadBytes(FILL_INPUT_PAYLOAD_LIMITS.maxContextFileBytes)} pro Datei.`,
		);
		fileSummaries.push({
			index: index + 1,
			mediaType: file.mimeType,
			name: file.name,
			payloadBytes,
			size: file.size,
		});
	}
	assertAtMost(
		fileTotalBytes,
		FILL_INPUT_PAYLOAD_LIMITS.maxContextFilesTotalBytes,
		`Die Dateien sind zusammen zu groß. Maximal erlaubt sind ${formatPayloadBytes(FILL_INPUT_PAYLOAD_LIMITS.maxContextFilesTotalBytes)}.`,
	);

	return { audioSummaries, fileSummaries };
};

/**
 * Prepares the agent's per-turn audio/file attachments for the standard model.
 *
 * Reuses the shared scribe media pipeline: each kind is attached natively when
 * the standard model declares the capability, and otherwise preprocessed
 * through the configured speech-to-text / file-image slot into text. The
 * returned `nativeContentParts` are appended to the latest user turn while
 * `injectedTextBlocks` carry transcripts/extracted text/metadata as context.
 */
export const prepareAgentMedia = async ({
	audioFiles,
	contextFiles,
	db,
	userId,
	zdr,
}: {
	audioFiles: AudioFile[];
	contextFiles: FillInputsContextFile[];
	db: Database;
	userId: string;
	zdr: boolean;
}): Promise<PreparedAgentMedia> => {
	const hasAudio = audioFiles.length > 0;
	const hasFiles = contextFiles.length > 0;
	if (!(hasAudio || hasFiles)) {
		return EMPTY_PREPARED_MEDIA;
	}

	const { audioSummaries, fileSummaries } = validateAgentMediaPayload(
		audioFiles,
		contextFiles,
	);

	const strategy = await resolveAgentGenerationStrategy(db, { hasAudio, hasFiles }).catch(
		(error: unknown) => {
			const message = error instanceof Error ? error.message : USER_MESSAGES.unknownError;
			throw new ORPCError("BAD_REQUEST", { message });
		},
	);

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
				strategy: filesPlan.strategy,
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
