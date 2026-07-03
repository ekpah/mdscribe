"use client";

import {
	FILL_INPUT_PAYLOAD_LIMITS,
	formatPayloadBytes,
} from "@/lib/input-fill-limits";
import type { AudioRecording, UploadedContextFile } from "./types";

interface ContextFileLimits {
	maxFileBytes?: number;
	maxFiles?: number;
	maxTotalBytes?: number;
}

interface AddContextFilesResult {
	files: UploadedContextFile[];
	message?: string;
	ok: boolean;
}

interface AddAudioFilesResult {
	message?: string;
	ok: boolean;
	recordings: AudioRecording[];
}

const getContextFilesTotalSize = (files: UploadedContextFile[]): number => {
	let total = 0;
	for (const { file } of files) {
		total += file.size;
	}
	return total;
};

const createUploadedContextFile = (file: File): UploadedContextFile => ({
	file,
	id: `file-${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID()}`,
});

const createAudioRecordingFromFile = (file: File): AudioRecording => ({
	blob: file,
	duration: 0,
	id: `audio-file-${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID()}`,
	mimeType: file.type,
	sourceDeviceLabel: "Eingefügte Audiodatei",
	url: URL.createObjectURL(file),
});

export const addAudioFilesToValue = ({
	currentRecordings,
	files,
	maxRecordings,
}: {
	currentRecordings: AudioRecording[];
	files: File[];
	maxRecordings: number;
}): AddAudioFilesResult => {
	if (files.length === 0) {
		return { ok: true, recordings: currentRecordings };
	}

	if (currentRecordings.length + files.length > maxRecordings) {
		return {
			message: `Maximal ${maxRecordings} Audioaufnahmen möglich.`,
			ok: false,
			recordings: currentRecordings,
		};
	}

	let totalBytes = 0;
	for (const recording of currentRecordings) {
		totalBytes += recording.blob.size;
	}
	for (const file of files) {
		if (file.size > FILL_INPUT_PAYLOAD_LIMITS.maxAudioPayloadBytesPerRecording) {
			return {
				message: `"${file.name}" ist zu groß. Maximal ${formatPayloadBytes(FILL_INPUT_PAYLOAD_LIMITS.maxAudioPayloadBytesPerRecording)} pro Audioaufnahme.`,
				ok: false,
				recordings: currentRecordings,
			};
		}
		totalBytes += file.size;
	}

	if (totalBytes > FILL_INPUT_PAYLOAD_LIMITS.maxAudioPayloadBytesTotal) {
		return {
			message: `Audioaufnahmen sind zusammen zu groß. Maximal ${formatPayloadBytes(FILL_INPUT_PAYLOAD_LIMITS.maxAudioPayloadBytesTotal)} möglich.`,
			ok: false,
			recordings: currentRecordings,
		};
	}

	return {
		ok: true,
		recordings: [
			...currentRecordings,
			...files.map(createAudioRecordingFromFile),
		],
	};
};

export const addContextFilesToValue = ({
	currentFiles,
	files,
	maxFileBytes = FILL_INPUT_PAYLOAD_LIMITS.maxContextFileBytes,
	maxFiles = FILL_INPUT_PAYLOAD_LIMITS.maxContextFiles,
	maxTotalBytes = FILL_INPUT_PAYLOAD_LIMITS.maxContextFilesTotalBytes,
}: ContextFileLimits & {
	currentFiles: UploadedContextFile[];
	files: File[];
}): AddContextFilesResult => {
	if (files.length === 0) {
		return { files: currentFiles, ok: true };
	}

	if (currentFiles.length + files.length > maxFiles) {
		return {
			files: currentFiles,
			message: `Maximal ${maxFiles} Dateien möglich.`,
			ok: false,
		};
	}

	for (const file of files) {
		if (file.size > maxFileBytes) {
			return {
				files: currentFiles,
				message: `"${file.name}" ist zu groß. Maximal ${formatPayloadBytes(maxFileBytes)} pro Datei.`,
				ok: false,
			};
		}
	}

	const nextTotalSize =
		getContextFilesTotalSize(currentFiles) +
		files.reduce((sum, file) => sum + file.size, 0);
	if (nextTotalSize > maxTotalBytes) {
		return {
			files: currentFiles,
			message: `Dateien sind zusammen zu groß. Maximal ${formatPayloadBytes(maxTotalBytes)} möglich.`,
			ok: false,
		};
	}

	return {
		files: [...currentFiles, ...files.map(createUploadedContextFile)],
		ok: true,
	};
};
