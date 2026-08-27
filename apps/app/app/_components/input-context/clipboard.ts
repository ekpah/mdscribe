interface ClipboardFileData {
	files: FileList;
	items: DataTransferItemList;
}

interface ClipboardInputFiles {
	audioFiles: File[];
	contextFiles: File[];
}

/**
 * Returns file-like clipboard items without touching plain text. Browsers
 * normally expose these through `files`; `items` is a fallback for browsers
 * that only expose copied screenshots and other clipboard media there.
 */
export const getClipboardFiles = (clipboardData: ClipboardFileData | null | undefined): File[] => {
	if (!clipboardData) {
		return [];
	}

	const files = [...clipboardData.files];
	if (files.length > 0) {
		return files;
	}

	const itemFiles: File[] = [];
	for (const item of clipboardData.items) {
		if (item.kind !== "file") {
			continue;
		}

		const file = item.getAsFile();
		if (file) {
			itemFiles.push(file);
		}
	}

	return itemFiles;
};

export const splitClipboardInputFiles = (files: File[]): ClipboardInputFiles => {
	const audioFiles: File[] = [];
	const contextFiles: File[] = [];

	for (const file of files) {
		if (file.type.toLowerCase().startsWith("audio/")) {
			audioFiles.push(file);
		} else {
			contextFiles.push(file);
		}
	}

	return { audioFiles, contextFiles };
};
