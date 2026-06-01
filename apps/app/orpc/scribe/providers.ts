import "server-only";

import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { aiDefaults, aiModel, aiProvider, and, eq } from "@repo/database";
import type { Database } from "@repo/database";
import { experimental_transcribe as transcribe } from "ai";
import type { LanguageModel } from "ai";

import { decrypt } from "@/lib/encryption";
import { normalizeOpenAICompatibleBaseUrl } from "@/lib/openai-compatible";
import { USER_MESSAGES } from "@/lib/user-messages";
import type { ReasoningEffort } from "@/orpc/scribe/types";

export type { ReasoningEffort } from "@/orpc/scribe/types";

type ProviderProtocol = typeof aiProvider.$inferSelect.protocol;

export type DefaultModelSlot =
	| "evaluation"
	| "file-image"
	| "multimodal"
	| "speech-to-text"
	| "text";

export interface TranscribeAudioInput {
	data: Buffer;
	filename: string;
	mediaType: string;
}

export interface ResolvedModel {
	isOpenRouter: boolean;
	model: LanguageModel;
	modelName: string;
	providerId: string;
	providerProtocol: ProviderProtocol;
	supportedParameters: string[];
	supportsReasoning: boolean;
	transcribeAudio?: (input: TranscribeAudioInput) => Promise<string>;
}

export interface ResolvedDefaultModelSelection {
	model: ResolvedModel;
	reasoningEffort: ReasoningEffort;
	slot: DefaultModelSlot;
}

type GenerationStrategy =
	| {
			generation: ResolvedDefaultModelSelection;
			mode: "direct";
		}
	| {
			fileImage?: ResolvedDefaultModelSelection;
			generation: ResolvedDefaultModelSelection;
			mode: "preprocess";
			speechToText?: ResolvedDefaultModelSelection;
		};

type AiModelRow = typeof aiModel.$inferSelect;
type AiProviderRow = typeof aiProvider.$inferSelect;
type AiDefaultsRow = typeof aiDefaults.$inferSelect;

const normalizeSupportedParameters = (parameters: string[] | undefined): string[] =>
	parameters ?? [];

const REASONING_EFFORTS = new Set<ReasoningEffort>([
	"none",
	"minimal",
	"low",
	"medium",
	"high",
	"xhigh",
]);

export const normalizeReasoningEffort = (
	value: string | null | undefined,
): ReasoningEffort =>
	REASONING_EFFORTS.has(value as ReasoningEffort)
		? (value as ReasoningEffort)
		: "none";

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

const isOpenAITranscriptionModel = (modelId: string): boolean => {
	const id = modelId.toLowerCase();
	return (
		id === "whisper-1" ||
		id.includes("transcribe") ||
		id.includes("transcription")
	);
};

const getOpenRouterAudioFormat = (mediaType: string): string => {
	const baseType = mediaType.split(";")[0]?.trim().toLowerCase();

	switch (baseType) {
		case "audio/mpeg":
		case "audio/mp3":
			return "mp3";
		case "audio/mp4":
		case "audio/m4a":
		case "audio/x-m4a":
			return "m4a";
		case "audio/wave":
		case "audio/wav":
		case "audio/x-wav":
			return "wav";
		case "audio/webm":
			return "webm";
		case "audio/ogg":
			return "ogg";
		case "audio/flac":
			return "flac";
		case "audio/aac":
			return "aac";
		case "audio/aiff":
			return "aiff";
		default:
			return baseType?.replace(/^audio\//, "") || "webm";
	}
};

/**
 * Creates a speech-to-text adapter for providers that expose transcription
 * through a separate API path. The adapter is only used when a model is selected
 * in the global speech-to-text slot; multimodal defaults still receive native
 * audio parts.
 */
const createAudioTranscriber = (
	protocol: string,
	modelId: string,
	apiKey: string | undefined,
): ResolvedModel["transcribeAudio"] | undefined => {
	if (protocol === "openai" && isOpenAITranscriptionModel(modelId)) {
		const provider = createOpenAI({ apiKey: apiKey ?? "" });
		const transcriptionModel = provider.transcription(
			modelId as Parameters<typeof provider.transcription>[0],
		);
		return async ({ data }) => {
			const result = await transcribe({
				audio: data,
				model: transcriptionModel,
			});
			return result.text.trim();
		};
	}

	if (protocol === "openrouter") {
		return async ({ data, mediaType }) => {
			const response = await fetch(
				"https://openrouter.ai/api/v1/audio/transcriptions",
				{
					body: JSON.stringify({
						input_audio: {
							data: data.toString("base64"),
							format: getOpenRouterAudioFormat(mediaType),
						},
						model: modelId,
					}),
					headers: {
						...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
						"Content-Type": "application/json",
					},
					method: "POST",
				},
			);

			if (!response.ok) {
				throw new Error(
					`OpenRouter-Transkription fehlgeschlagen: HTTP ${response.status}`,
				);
			}

			const body = (await response.json()) as {
				text?: unknown;
				transcription?: unknown;
			};
			const text =
				typeof body.text === "string"
					? body.text
					: typeof body.transcription === "string"
						? body.transcription
						: "";
			if (!text.trim()) {
				throw new Error("OpenRouter-Transkription lieferte keinen Text.");
			}
			return text.trim();
		};
	}

	return undefined;
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
	const transcribeAudio = createAudioTranscriber(
		provider.protocol,
		model.modelId,
		apiKey,
	);
	const supportedParameters = normalizeSupportedParameters(model.supportedParameters);

	return {
		isOpenRouter: provider.protocol === "openrouter",
		model: languageModel,
		modelName: model.modelId,
		providerId: provider.id,
		providerProtocol: provider.protocol,
		supportedParameters,
		supportsReasoning: model.supportsReasoning || supportedParameters.includes("reasoning"),
		...(transcribeAudio ? { transcribeAudio } : {}),
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

const getDefaults = async (db: Database): Promise<AiDefaultsRow> => {
	const defaults = await db.query.aiDefaults.findFirst({
		where: eq(aiDefaults.id, "global"),
	});

	if (!defaults) {
		throw new Error(USER_MESSAGES.modelUnavailable);
	}

	return defaults;
};

const getDefaultModelRecordId = (
	defaults: AiDefaultsRow,
	slot: DefaultModelSlot,
): string | null => {
	switch (slot) {
		case "evaluation":
			return defaults.defaultEvaluationModel;
		case "file-image":
			return defaults.defaultFileImageModelId;
		case "multimodal":
			return defaults.defaultMultimodalModelId;
		case "speech-to-text":
			return defaults.defaultSpeechToTextModelId;
		case "text":
			return defaults.defaultTextModelId;
	}
};

const getDefaultReasoningEffort = (
	defaults: AiDefaultsRow,
	slot: DefaultModelSlot,
): ReasoningEffort => {
	switch (slot) {
		case "evaluation":
			return normalizeReasoningEffort(defaults.defaultEvaluationReasoningEffort);
		case "file-image":
			return normalizeReasoningEffort(defaults.defaultFileImageReasoningEffort);
		case "multimodal":
			return normalizeReasoningEffort(defaults.defaultMultimodalReasoningEffort);
		case "speech-to-text":
			return normalizeReasoningEffort(defaults.defaultSpeechToTextReasoningEffort);
		case "text":
			return normalizeReasoningEffort(defaults.defaultTextReasoningEffort);
	}
};

const buildDefaultSelection = async (
	db: Database,
	defaults: AiDefaultsRow,
	slot: DefaultModelSlot,
): Promise<ResolvedDefaultModelSelection> => {
	const modelRecordId = getDefaultModelRecordId(defaults, slot);
	if (!modelRecordId) {
		throw new Error(USER_MESSAGES.modelUnavailable);
	}

	return {
		model: await resolveModelByRecordId(modelRecordId, db),
		reasoningEffort: getDefaultReasoningEffort(defaults, slot),
		slot,
	};
};

export const resolveDefaultModel = async (
	db: Database,
	slot: DefaultModelSlot,
): Promise<ResolvedDefaultModelSelection> => {
	const defaults = await getDefaults(db);
	return buildDefaultSelection(db, defaults, slot);
};

/**
 * Resolves the global model strategy for a generation request.
 *
 * A configured multimodal default is treated as authoritative for text, audio,
 * and file/image input. Without it, media is preprocessed through the dedicated
 * speech-to-text and file/image defaults before the final text model runs.
 */
export const resolveGenerationStrategy = async (
	db: Database,
	options: { hasAudio?: boolean; hasFiles?: boolean },
): Promise<GenerationStrategy> => {
	const defaults = await getDefaults(db);
	if (defaults.defaultMultimodalModelId) {
		return {
			generation: await buildDefaultSelection(db, defaults, "multimodal"),
			mode: "direct",
		};
	}

	return {
		...(options.hasFiles
			? { fileImage: await buildDefaultSelection(db, defaults, "file-image") }
			: {}),
		generation: await buildDefaultSelection(db, defaults, "text"),
		mode: "preprocess",
		...(options.hasAudio
			? {
					speechToText: await buildDefaultSelection(
						db,
						defaults,
						"speech-to-text",
					),
				}
			: {}),
	};
};

export const buildProviderOptions = ({
	includeUsage,
	model,
	reasoningEffort,
	userId,
	zdr,
}: {
	includeUsage?: boolean;
	model: ResolvedModel;
	reasoningEffort?: ReasoningEffort;
	userId?: string;
	zdr?: boolean;
}) => {
	if (!model.isOpenRouter) {
		return undefined;
	}

	const normalizedReasoningEffort = normalizeReasoningEffort(reasoningEffort);
	const reasoningConfig =
		model.supportsReasoning && normalizedReasoningEffort !== "none"
			? { effort: normalizedReasoningEffort }
			: undefined;

	return {
		openrouter: {
			...(includeUsage ? { usage: { include: true } } : {}),
			...(userId ? { user: userId } : {}),
			...(reasoningConfig ? { reasoning: reasoningConfig } : {}),
			...(zdr ? { zdr: true } : {}),
		},
	};
};
