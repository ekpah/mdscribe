export type InputMode = "text" | "audio" | "file" | "image";

const isGemma3nMultimodalModel = (modelId: string): boolean => {
	const id = modelId.toLowerCase();
	return (
		id.includes("gemma-3n") ||
		(id.includes("gemma") &&
			(id.includes("e4b") || id.includes("e2b")))
	);
};

export const inferInputModesFromModelId = (modelId: string): InputMode[] => {
	const id = modelId.toLowerCase();
	const modes = new Set<InputMode>(["text"]);

	const hasImageInput =
		id.includes("vision") ||
		id.includes("vlm") ||
		id.includes("visual") ||
		id.includes("llava") ||
		id.includes("moondream") ||
		id.includes("-vl") ||
		id.includes(":vl") ||
		id.includes("image") ||
		id.includes("ocr") ||
		id.includes("pdf") ||
		isGemma3nMultimodalModel(id);
	if (hasImageInput) {
		modes.add("image");
		modes.add("file");
	}

	const hasAudioInput =
		id.includes("audio") ||
		id.includes("whisper") ||
		id.includes("transcribe") ||
		id.includes("asr") ||
		id.includes("speech") ||
		isGemma3nMultimodalModel(id);
	if (hasAudioInput) {
		modes.add("audio");
	}

	return [...modes];
};

export const normalizeInputModes = (modes: readonly string[]): InputMode[] => {
	const allowed = new Set<InputMode>(["text", "audio", "file", "image"]);
	const unique = new Set<InputMode>();
	for (const mode of modes) {
		if (allowed.has(mode as InputMode)) {
			unique.add(mode as InputMode);
		}
	}
	if (!unique.has("text")) {
		unique.add("text");
	}
	return [...unique];
};

export const resolveInputModes = (
	modes: readonly string[],
	modelId: string,
): InputMode[] => {
	const merged = new Set<InputMode>(normalizeInputModes(modes));
	for (const inferredMode of inferInputModesFromModelId(modelId)) {
		merged.add(inferredMode);
	}
	return [...merged];
};
