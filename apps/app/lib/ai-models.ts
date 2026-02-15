import { supportedModels, type SupportedModel } from "@/orpc/scribe/types";

interface ModelDetails {
	name: string;
	supportsAudio: boolean;
}

export const modelDetails: Record<SupportedModel, ModelDetails> = {
	auto: { name: "Auto", supportsAudio: true },
	"glm-4p6": { name: "GLM-4.6", supportsAudio: false },
	"claude-opus-4.5": { name: "Claude Opus 4.5", supportsAudio: false },
	"gemini-3-pro": { name: "Gemini 3 Pro", supportsAudio: false },
	"gemini-3-flash": { name: "Gemini 3 Flash", supportsAudio: true },
};

export const modelOptions = supportedModels.map((id) => ({
	id,
	name: modelDetails[id].name,
	supportsAudio: modelDetails[id].supportsAudio,
}));

export const audioCapableModels = supportedModels.filter(
	(model) => modelDetails[model].supportsAudio,
);

export const isAudioCapableModel = (model: SupportedModel) =>
	modelDetails[model].supportsAudio;
