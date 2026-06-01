export const FILL_INPUT_PAYLOAD_LIMITS = {
	maxAudioFiles: 3,
	maxAudioPayloadBytesPerRecording: 12 * 1024 * 1024,
	maxAudioPayloadBytesTotal: 30 * 1024 * 1024,
	maxContextFileBytes: 10 * 1024 * 1024,
	maxContextFiles: 5,
	maxContextFilesTotalBytes: 25 * 1024 * 1024,
	maxInputFieldDescriptionCharacters: 2_000,
	maxInputFieldLabelCharacters: 200,
	maxInputFields: 100,
	maxTextContextCharacters: 30_000,
} as const;

export const getBase64DecodedByteLength = (value: string | undefined): number => {
	const normalized = (value ?? "").split(",").at(-1)?.replaceAll(/\s/g, "") ?? "";
	if (!normalized) {
		return 0;
	}

	const padding =
		normalized.endsWith("==") ? 2 : normalized.endsWith("=") ? 1 : 0;
	return Math.max(0, Math.floor((normalized.length * 3) / 4) - padding);
};

export const formatPayloadBytes = (bytes: number): string => {
	if (bytes >= 1024 * 1024) {
		return `${(bytes / (1024 * 1024)).toLocaleString("de-DE", {
			maximumFractionDigits: 1,
			minimumFractionDigits: 0,
		})} MB`;
	}

	return `${Math.ceil(bytes / 1024).toLocaleString("de-DE")} KB`;
};

