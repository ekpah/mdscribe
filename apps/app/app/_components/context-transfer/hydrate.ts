"use client";

import type {
	AudioRecording,
	InputContextController,
	UploadedContextFile,
} from "@/app/_components/input-context/types";
import type { ContextTransferPayload } from "./types";

const base64ToBlob = (data: string, mimeType: string): Blob => {
	const binary = atob(data);
	const bytes = new Uint8Array(binary.length);
	for (let index = 0; index < binary.length; index += 1) {
		bytes[index] = binary.codePointAt(index) ?? 0;
	}
	return new Blob([bytes], { type: mimeType });
};

export const createUploadedFilesFromTransferPayload = (
	payload: ContextTransferPayload,
): UploadedContextFile[] =>
	payload.contextFiles.map((contextFile, index) => {
		const blob = base64ToBlob(contextFile.data, contextFile.mimeType);
		const file = new File([blob], contextFile.name, {
			type: contextFile.mimeType,
		});
		return {
			file,
			id: `transfer-file-${index}-${contextFile.name}-${contextFile.size}`,
		};
	});

export const createAudioRecordingsFromTransferPayload = (
	payload: ContextTransferPayload,
): AudioRecording[] =>
	payload.audioFiles.map((audioFile, index) => {
		const blob = base64ToBlob(audioFile.data, audioFile.mimeType);
		return {
			blob,
			duration: audioFile.duration ?? 0,
			id: `transfer-audio-${index}-${Date.now()}`,
			mimeType: audioFile.mimeType,
			sourceDeviceLabel: audioFile.sourceDeviceLabel ?? "Transfer",
			url: URL.createObjectURL(blob),
		};
	});

export const hydrateInputContextController = (
	controller: InputContextController,
	payload: ContextTransferPayload,
) => {
	controller.setTextContext(payload.textContext);
	controller.setContextFiles(createUploadedFilesFromTransferPayload(payload));
	controller.setAudioRecordings(createAudioRecordingsFromTransferPayload(payload));
};
