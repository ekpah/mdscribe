"use client";

import { FILL_INPUT_PAYLOAD_LIMITS, formatPayloadBytes } from "@/lib/input-fill-limits";

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

export const createUploadedContextFile = (file: File): UploadedContextFile => ({
	file,
	id: `file-${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID()}`,
	ocrStatus: file.type.startsWith("image/") ? "awaiting-alignment" : "pending",
});

// Matches the server's OCR page bound; larger images are downscaled there anyway.
const MAX_ROTATED_IMAGE_SIDE = 3000;

/**
 * Rotates an image clockwise by `turn` degrees, applying its EXIF orientation
 * first. Users must align and confirm images before recognition.
 */
export const rotateImageFile = async (file: File, turn: 0 | 90 | 180 | 270): Promise<File> => {
	const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
	const scale = Math.min(1, MAX_ROTATED_IMAGE_SIDE / Math.max(bitmap.width, bitmap.height));
	const width = Math.round(bitmap.width * scale);
	const height = Math.round(bitmap.height * scale);
	const sideways = turn === 90 || turn === 270;
	const canvas = new OffscreenCanvas(sideways ? height : width, sideways ? width : height);
	const context = canvas.getContext("2d");
	if (!context) {
		bitmap.close();
		throw new Error("Das Bild konnte nicht gedreht werden.");
	}
	context.translate(
		turn === 90 || turn === 180 ? canvas.width : 0,
		turn === 180 || turn === 270 ? canvas.height : 0,
	);
	context.rotate((turn * Math.PI) / 180);
	context.drawImage(bitmap, 0, 0, width, height);
	bitmap.close();
	// Always JPEG: a re-encoded PNG photo could exceed the upload size limit.
	const blob = await canvas.convertToBlob({ quality: 0.92, type: "image/jpeg" });
	return new File([blob], `${file.name.replace(/\.[^.]+$/, "")}.jpg`, {
		lastModified: Date.now(),
		type: "image/jpeg",
	});
};

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
		recordings: [...currentRecordings, ...files.map(createAudioRecordingFromFile)],
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
		getContextFilesTotalSize(currentFiles) + files.reduce((sum, file) => sum + file.size, 0);
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
