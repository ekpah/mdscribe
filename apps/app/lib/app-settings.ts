import { z } from "zod";
import { isAudioCapableModel } from "@/lib/ai-models";
import { supportedModels, type SupportedModel } from "@/orpc/scribe/types";

const supportedModelSchema = z.enum(supportedModels);

const multiModelSchema = z.object({
	mode: z.literal("multi"),
	defaultModel: supportedModelSchema,
	availableModels: z.array(supportedModelSchema).min(1),
});

const singleModelSchema = z.object({
	mode: z.literal("single"),
	primaryModel: supportedModelSchema,
	audioModel: supportedModelSchema.optional(),
});

export const appSettingsSchema = z.object({
	provider: z.literal("openrouter"),
	modelSelection: z.union([multiModelSchema, singleModelSchema]),
});

export type AppSettings = z.infer<typeof appSettingsSchema>;

export const defaultAppSettings: AppSettings = {
	provider: "openrouter",
	modelSelection: {
		mode: "multi",
		defaultModel: "auto",
		availableModels: [...supportedModels],
	},
};

const dedupeModels = (models: SupportedModel[]): SupportedModel[] => {
	const seen = new Set<SupportedModel>();
	const result: SupportedModel[] = [];

	for (const model of models) {
		if (!seen.has(model)) {
			seen.add(model);
			result.push(model);
		}
	}

	return result;
};

export const normalizeAppSettings = (settings: AppSettings): AppSettings => {
	if (settings.modelSelection.mode === "multi") {
		const availableModels = dedupeModels(settings.modelSelection.availableModels);
		const resolvedAvailable =
			availableModels.length > 0 ? availableModels : [...supportedModels];
		const defaultModel = resolvedAvailable.includes(
			settings.modelSelection.defaultModel,
		)
			? settings.modelSelection.defaultModel
			: resolvedAvailable[0];

		return {
			...settings,
			modelSelection: {
				mode: "multi",
				defaultModel,
				availableModels: resolvedAvailable,
			},
		};
	}

	const audioModel =
		settings.modelSelection.audioModel &&
		isAudioCapableModel(settings.modelSelection.audioModel)
			? settings.modelSelection.audioModel
			: undefined;

	return {
		...settings,
		modelSelection: {
			mode: "single",
			primaryModel: settings.modelSelection.primaryModel,
			...(audioModel ? { audioModel } : {}),
		},
	};
};

export const parseAppSettings = (data: unknown): AppSettings => {
	const parsed = appSettingsSchema.safeParse(data);
	if (!parsed.success) {
		return defaultAppSettings;
	}

	return normalizeAppSettings(parsed.data);
};

export const resolveScribeModel = (
	settings: AppSettings,
	requestedModel: SupportedModel,
	hasAudio: boolean,
): SupportedModel => {
	const normalized = normalizeAppSettings(settings);
	const selection = normalized.modelSelection;

	if (selection.mode === "single") {
		if (hasAudio && selection.audioModel && isAudioCapableModel(selection.audioModel)) {
			return selection.audioModel;
		}
		return selection.primaryModel;
	}

	if (selection.availableModels.includes(requestedModel)) {
		return requestedModel;
	}

	return selection.defaultModel;
};
