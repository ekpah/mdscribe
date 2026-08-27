"use client";

import {
	blobToBase64,
	createAudioSubmissionFile,
} from "@repo/design-system/components/inputs/audio-submission";
import { useCallback, useState } from "react";
import { toast } from "sonner";

import {
	FILL_INPUT_PAYLOAD_LIMITS,
	formatPayloadBytes,
	getBase64DecodedByteLength,
} from "@/lib/input-fill-limits";

import { addAudioFilesToValue, addContextFilesToValue } from "./files";
import {
	getTextContextCharacterCount,
	getTextContextFieldCount,
	toSubmittedTextContext,
} from "./inputs/text/text-input";
import type {
	AudioRecording,
	InputContextAudioFile,
	InputContextController,
	InputContextFile,
	InputContextSubmission,
	InputContextTextContext,
	UploadedContextFile,
} from "./types";

interface UseInputContextStateOptions {
	maxRecordings?: number;
}

const fileToContextFile = async (file: File): Promise<InputContextFile> => ({
	data: await blobToBase64(file),
	mimeType: file.type || "application/octet-stream",
	name: file.name,
	size: file.size,
});

const getAudioSubmissionPayloadBytes = (audioFile: InputContextAudioFile): number =>
	getBase64DecodedByteLength(audioFile.data) +
	getBase64DecodedByteLength(audioFile.wavFallback?.data);

export const useInputContextState = ({
	maxRecordings = 3,
}: UseInputContextStateOptions = {}): InputContextController => {
	const [audioRecordings, setAudioRecordings] = useState<AudioRecording[]>([]);
	const [contextFiles, setContextFiles] = useState<UploadedContextFile[]>([]);
	const [textContext, setTextContextState] = useState<InputContextTextContext>({});
	const effectiveMaxRecordings = Math.min(maxRecordings, FILL_INPUT_PAYLOAD_LIMITS.maxAudioFiles);

	const textContextFieldCount = getTextContextFieldCount(textContext);
	const hasTextContext = textContextFieldCount > 0;
	const hasAudioRecordings = audioRecordings.length > 0;
	const hasContextFiles = contextFiles.length > 0;
	const hasAnyContext = hasAudioRecordings || hasTextContext || hasContextFiles;

	const addAudioFiles = useCallback(
		(files: File[]) => {
			const result = addAudioFilesToValue({
				currentRecordings: audioRecordings,
				files,
				maxRecordings: effectiveMaxRecordings,
			});
			if (!result.ok) {
				if (result.message) {
					toast.error(result.message);
				}
				return false;
			}

			setAudioRecordings(result.recordings);
			return true;
		},
		[audioRecordings, effectiveMaxRecordings],
	);

	const addContextFiles = useCallback(
		(files: File[]) => {
			const result = addContextFilesToValue({
				currentFiles: contextFiles,
				files,
			});
			if (!result.ok) {
				if (result.message) {
					toast.error(result.message);
				}
				return false;
			}

			setContextFiles(result.files);
			return true;
		},
		[contextFiles],
	);

	const setTextContext = useCallback((nextTextContext: InputContextTextContext) => {
		if (
			getTextContextCharacterCount(nextTextContext) >
			FILL_INPUT_PAYLOAD_LIMITS.maxTextContextCharacters
		) {
			toast.error(
				`Textkontext ist zu lang. Maximal ${FILL_INPUT_PAYLOAD_LIMITS.maxTextContextCharacters.toLocaleString("de-DE")} Zeichen möglich.`,
			);
			return;
		}

		setTextContextState(nextTextContext);
	}, []);

	const prepareSubmission = useCallback(async (): Promise<InputContextSubmission> => {
		const audioFiles = await Promise.all(
			audioRecordings.map((recording) => createAudioSubmissionFile(recording.blob)),
		);
		let audioPayloadBytes = 0;
		for (const [index, audioFile] of audioFiles.entries()) {
			const recordingPayloadBytes = getAudioSubmissionPayloadBytes(audioFile);
			audioPayloadBytes += recordingPayloadBytes;
			if (recordingPayloadBytes > FILL_INPUT_PAYLOAD_LIMITS.maxAudioPayloadBytesPerRecording) {
				throw new Error(
					`Aufnahme ${index + 1} ist zu groß. Maximal ${formatPayloadBytes(FILL_INPUT_PAYLOAD_LIMITS.maxAudioPayloadBytesPerRecording)} pro Aufnahme.`,
				);
			}
		}
		if (audioPayloadBytes > FILL_INPUT_PAYLOAD_LIMITS.maxAudioPayloadBytesTotal) {
			throw new Error(
				`Audioaufnahmen sind zusammen zu groß. Maximal ${formatPayloadBytes(FILL_INPUT_PAYLOAD_LIMITS.maxAudioPayloadBytesTotal)} möglich.`,
			);
		}

		const submittedContextFiles = await Promise.all(
			contextFiles.map(({ file }) => fileToContextFile(file)),
		);

		return {
			audioFiles,
			contextFiles: submittedContextFiles,
			textContext: toSubmittedTextContext(textContext),
		};
	}, [audioRecordings, contextFiles, textContext]);

	return {
		addAudioFiles,
		addContextFiles,
		audioRecordings,
		contextFiles,
		effectiveMaxRecordings,
		hasAnyContext,
		hasAudioRecordings,
		hasContextFiles,
		hasTextContext,
		prepareSubmission,
		setAudioRecordings,
		setContextFiles,
		setTextContext,
		textContext,
	};
};
