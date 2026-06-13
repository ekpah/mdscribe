"use client";

import {
	FILL_INPUT_PAYLOAD_LIMITS,
	formatPayloadBytes,
} from "@/lib/input-fill-limits";
import type { UploadedContextFile } from "./types";

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
