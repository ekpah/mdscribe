import { ORPCError } from "@orpc/server";

import {
	FILL_INPUT_PAYLOAD_LIMITS,
	formatPayloadBytes,
	getBase64DecodedByteLength,
	getContextDocumentPayloadByteLength,
} from "@/lib/input-fill-limits";
import type { AudioFile, FillInputsContextFile } from "@/orpc/scribe/types";

export interface AudioPayloadSummary {
	index: number;
	mediaType: string;
	payloadBytes: number;
	wavFallbackBytes: number;
	totalBytes: number;
}

export interface ContextFilePayloadSummary {
	index: number;
	mediaType?: string;
	name: string;
	payloadBytes: number;
	size?: number;
}

export const assertAtMost = (value: number, limit: number, message: string) => {
	if (value > limit) {
		throw new ORPCError("BAD_REQUEST", { message });
	}
};

/** Enforce the shared audio limits and summarize each recording for usage logging. */
export const validateScribeAudioFiles = (audioFiles: AudioFile[]): AudioPayloadSummary[] => {
	assertAtMost(
		audioFiles.length,
		FILL_INPUT_PAYLOAD_LIMITS.maxAudioFiles,
		`Maximal ${FILL_INPUT_PAYLOAD_LIMITS.maxAudioFiles} Audioaufnahmen können berücksichtigt werden.`,
	);

	const summaries = audioFiles.map((audioFile, index): AudioPayloadSummary => {
		const payloadBytes = getBase64DecodedByteLength(audioFile.data);
		const wavFallbackBytes = getBase64DecodedByteLength(audioFile.wavFallback?.data);
		const totalBytes = payloadBytes + wavFallbackBytes;

		if (payloadBytes === 0) {
			throw new ORPCError("BAD_REQUEST", {
				message: `Audioaufnahme ${index + 1} enthält keine Audiodaten.`,
			});
		}
		assertAtMost(
			totalBytes,
			FILL_INPUT_PAYLOAD_LIMITS.maxAudioPayloadBytesPerRecording,
			`Audioaufnahme ${index + 1} ist zu groß. Maximal erlaubt sind ${formatPayloadBytes(FILL_INPUT_PAYLOAD_LIMITS.maxAudioPayloadBytesPerRecording)} pro Aufnahme.`,
		);

		return {
			index: index + 1,
			mediaType: audioFile.mimeType,
			payloadBytes,
			totalBytes,
			wavFallbackBytes,
		};
	});

	assertAtMost(
		summaries.reduce((sum, file) => sum + file.totalBytes, 0),
		FILL_INPUT_PAYLOAD_LIMITS.maxAudioPayloadBytesTotal,
		`Die Audioaufnahmen sind zusammen zu groß. Maximal erlaubt sind ${formatPayloadBytes(FILL_INPUT_PAYLOAD_LIMITS.maxAudioPayloadBytesTotal)}.`,
	);

	return summaries;
};

/** Enforce the shared context-file limits and summarize each file for usage logging. */
export const validateScribeContextFiles = (
	contextFiles: FillInputsContextFile[],
): ContextFilePayloadSummary[] => {
	assertAtMost(
		contextFiles.length,
		FILL_INPUT_PAYLOAD_LIMITS.maxContextFiles,
		`Maximal ${FILL_INPUT_PAYLOAD_LIMITS.maxContextFiles} Dateien können berücksichtigt werden.`,
	);

	const summaries = contextFiles.map((file, index): ContextFilePayloadSummary => {
		const payloadBytes = getContextDocumentPayloadByteLength(file);
		assertAtMost(
			payloadBytes,
			FILL_INPUT_PAYLOAD_LIMITS.maxContextFileBytes,
			`Die Datei "${file.name}" ist zu groß. Maximal erlaubt sind ${formatPayloadBytes(FILL_INPUT_PAYLOAD_LIMITS.maxContextFileBytes)} pro Datei.`,
		);
		return {
			index: index + 1,
			...(file.kind === "ocr" ? {} : { mediaType: file.mimeType, size: file.size }),
			name: file.name,
			payloadBytes,
		};
	});

	assertAtMost(
		summaries.reduce((sum, file) => sum + file.payloadBytes, 0),
		FILL_INPUT_PAYLOAD_LIMITS.maxContextFilesTotalBytes,
		`Die Dateien sind zusammen zu groß. Maximal erlaubt sind ${formatPayloadBytes(FILL_INPUT_PAYLOAD_LIMITS.maxContextFilesTotalBytes)}.`,
	);

	return summaries;
};
