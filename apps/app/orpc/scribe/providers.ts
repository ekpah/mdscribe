import "server-only";

import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { aiDefaults, aiModel, aiProvider, and, eq } from '@repo/database';
import type { Database } from '@repo/database';
import type { LanguageModel } from "ai";

import { decrypt } from "@/lib/encryption";
import { normalizeOpenAICompatibleBaseUrl } from "@/lib/openai-compatible";
import { USER_MESSAGES } from "@/lib/user-messages";

type InputMode = "text" | "audio" | "file" | "image";

interface ResolvedModel {
	model: LanguageModel;
	modelName: string;
	providerId: string;
	supportsReasoning: boolean;
	inputModes: InputMode[];
	isOpenRouter: boolean;
}

interface ResolveModelOptions {
	requireAudio?: boolean;
	requireFiles?: boolean;
}

type AiModelRow = typeof aiModel.$inferSelect;
type AiProviderRow = typeof aiProvider.$inferSelect;

const toInputModes = (modes: string[]): InputMode[] => {
	const allowed = new Set<InputMode>(["text", "audio", "file", "image"]);
	const resolved = new Set<InputMode>();
	for (const mode of modes) {
		if (allowed.has(mode as InputMode)) {
			resolved.add(mode as InputMode);
		}
	}
	if (!resolved.has("text")) {
		resolved.add("text");
	}
	return [...resolved];
};

const createProviderModel = (
	protocol: string,
	modelId: string,
	apiKey: string | undefined,
	baseUrl: string | null,
): LanguageModel => {
	switch (protocol) {
		case "openrouter": {
			const provider = createOpenRouter({ apiKey: apiKey ?? "" });
			return provider(modelId);
		}
		case "openai": {
			const provider = createOpenAI({ apiKey: apiKey ?? "" });
			return provider(modelId);
		}
		case "anthropic": {
			const provider = createAnthropic({ apiKey: apiKey ?? "" });
			return provider(modelId);
		}
		case "openai-compatible": {
			if (!baseUrl) {
				throw new Error("OpenAI-compatible provider is missing a base URL");
			}
			const provider = createOpenAICompatible({
				apiKey: apiKey ?? "placeholder",
				baseURL: normalizeOpenAICompatibleBaseUrl(baseUrl),
				name: "custom",
			});
			return provider(modelId);
		}
		default: {
			throw new Error(`Unknown provider protocol: ${protocol}`);
		}
	}
};

const buildResolvedModel = async (
	model: AiModelRow,
	provider: AiProviderRow,
): Promise<ResolvedModel> => {
	const apiKey = provider.apiKey ? await decrypt(provider.apiKey) : undefined;

	const languageModel = createProviderModel(
		provider.protocol,
		model.modelId,
		apiKey,
		provider.baseUrl,
	);

	return {
		inputModes: toInputModes(model.inputModes),
		isOpenRouter: provider.protocol === "openrouter",
		model: languageModel,
		modelName: model.modelId,
		providerId: provider.id,
		supportsReasoning: model.supportsReasoning,
	};
};

export const resolveModelByRecordId = async (
	modelRecordId: string,
	db: Database,
): Promise<ResolvedModel> => {
	const rows = await db
		.select({
			model: aiModel,
			provider: aiProvider,
		})
		.from(aiModel)
		.innerJoin(aiProvider, eq(aiModel.providerId, aiProvider.id))
		.where(eq(aiModel.id, modelRecordId))
		.limit(1);

	const [row] = rows;
	if (!row) {
		throw new Error(USER_MESSAGES.modelUnavailable);
	}

	return buildResolvedModel(row.model, row.provider);
};

export const resolveProviderModel = async (
	providerId: string,
	modelId: string,
	db: Database,
): Promise<ResolvedModel> => {
	const provider = await db.query.aiProvider.findFirst({
		where: eq(aiProvider.id, providerId),
	});
	if (!provider) {
		throw new Error("Provider not found");
	}

	const model = await db.query.aiModel.findFirst({
		where: and(
			eq(aiModel.providerId, providerId),
			eq(aiModel.modelId, modelId),
		),
	});

	if (model) {
		return buildResolvedModel(model, provider);
	}

	throw new Error(USER_MESSAGES.modelUnavailable);
};

export const resolveModel = async (
	db: Database,
	options?: ResolveModelOptions,
): Promise<ResolvedModel> => {
	const defaults = await db.query.aiDefaults.findFirst({
		where: eq(aiDefaults.id, "global"),
	});

	if (!defaults) {
		throw new Error(USER_MESSAGES.modelUnavailable);
	}

	let defaultModelId = defaults.defaultTextModelId;
	if (options?.requireAudio) {
		defaultModelId = defaults.defaultSpeechToTextModelId;
	} else if (options?.requireFiles) {
		defaultModelId = defaults.defaultFileImageModelId;
	}

	if (!defaultModelId) {
		throw new Error(USER_MESSAGES.modelUnavailable);
	}

	const resolved = await resolveModelByRecordId(defaultModelId, db);
	if (options?.requireAudio && !resolved.inputModes.includes("audio")) {
		throw new Error(USER_MESSAGES.audioNotSupported);
	}
	if (
		options?.requireFiles &&
		!resolved.inputModes.includes("file") &&
		!resolved.inputModes.includes("image")
	) {
		throw new Error(USER_MESSAGES.filesNotSupported);
	}

	return resolved;
};
