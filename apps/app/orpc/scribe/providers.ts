import "server-only";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { aiDefaults, aiModel, aiProvider, and, eq } from "@repo/database";
import type { Database } from "@repo/database";
import { experimental_transcribe as transcribe } from "ai";
import type { JSONValue, LanguageModel } from "ai";

import { decrypt } from "@/lib/encryption";
import { normalizeOpenAICompatibleBaseUrl } from "@/lib/openai-compatible";
import { USER_MESSAGES } from "@/lib/user-messages";
import type { ReasoningEffort } from "@/orpc/scribe/types";

export type { ReasoningEffort } from "@/orpc/scribe/types";

type ProviderProtocol = typeof aiProvider.$inferSelect.protocol;

export type DefaultModelSlot =
	| "agent"
	| "evaluation"
	| "file-image"
	| "speech-to-text"
	| "text";

export type MediaPreprocessStrategy = "direct" | "multimodal";

export interface TranscribeAudioInput {
	data: Buffer;
	filename: string;
	mediaType: string;
}

export interface TranscribeAudioResult {
	providerMetadata?: Record<string, unknown>;
	text: string;
	usage?: unknown;
}

export interface ResolvedModel {
	isOpenRouter: boolean;
	model: LanguageModel;
	modelName: string;
	providerId: string;
	providerProtocol: ProviderProtocol;
	supportedParameters: string[];
	supportsReasoning: boolean;
	transcribeAudio?: (input: TranscribeAudioInput) => Promise<TranscribeAudioResult>;
}

export interface ResolvedDefaultModelSelection {
	/** Global default generation temperature, or null to use the provider standard. */
	defaultTemperature: number | null;
	model: ResolvedModel;
	reasoningEffort: ReasoningEffort;
	slot: DefaultModelSlot;
}

export type MediaPlan =
	| { mode: "native" }
	| {
			mode: "preprocess";
			selection: ResolvedDefaultModelSelection;
			strategy: MediaPreprocessStrategy;
	  };

interface GenerationStrategy {
	audio?: MediaPlan;
	files?: MediaPlan;
	generation: ResolvedDefaultModelSelection;
}

interface AgentGenerationStrategy extends GenerationStrategy {
	usesStandardModel: boolean;
}

type AiModelRow = typeof aiModel.$inferSelect;
type AiProviderRow = typeof aiProvider.$inferSelect;
type AiDefaultsRow = typeof aiDefaults.$inferSelect;

const normalizeSupportedParameters = (parameters: string[] | undefined): string[] =>
	parameters ?? [];

export const modelAllowsReasoningOptions = (
	model: Pick<ResolvedModel, "supportedParameters" | "supportsReasoning">,
): boolean => model.supportsReasoning || model.supportedParameters.length === 0;

const REASONING_EFFORTS = new Set<ReasoningEffort>([
	"none",
	"minimal",
	"low",
	"medium",
	"high",
	"xhigh",
]);

export const normalizeReasoningEffort = (value: string | null | undefined): ReasoningEffort =>
	REASONING_EFFORTS.has(value as ReasoningEffort) ? (value as ReasoningEffort) : "none";

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
	return id === "whisper-1" || id.includes("transcribe") || id.includes("transcription");
};

const getOpenRouterAudioFormat = (mediaType: string): string => {
	const baseType = mediaType.split(";")[0]?.trim().toLowerCase();

	switch (baseType) {
		case "audio/mpeg":
		case "audio/mp3": {
			return "mp3";
		}
		case "audio/mp4":
		case "audio/m4a":
		case "audio/x-m4a": {
			return "m4a";
		}
		case "audio/wave":
		case "audio/wav":
		case "audio/x-wav": {
			return "wav";
		}
		case "audio/webm": {
			return "webm";
		}
		case "audio/ogg": {
			return "ogg";
		}
		case "audio/flac": {
			return "flac";
		}
		case "audio/aac": {
			return "aac";
		}
		case "audio/aiff": {
			return "aiff";
		}
		default: {
			return baseType?.replace(/^audio\//, "") || "webm";
		}
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
	baseUrl: string | null,
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
			return {
				providerMetadata: (result as { providerMetadata?: Record<string, unknown> })
					.providerMetadata,
				text: result.text.trim(),
				usage: (result as { usage?: unknown }).usage,
			};
		};
	}

	if (protocol === "openai-compatible") {
		if (!baseUrl) {
			throw new Error("OpenAI-compatible provider is missing a base URL");
		}
		const endpoint = `${normalizeOpenAICompatibleBaseUrl(baseUrl)}/audio/transcriptions`;
		return async ({ data, filename, mediaType }) => {
			const formData = new FormData();
			formData.append("file", new File([new Uint8Array(data)], filename, { type: mediaType }));
			formData.append("model", modelId);

			const response = await fetch(endpoint, {
				body: formData,
				...(apiKey ? { headers: { Authorization: `Bearer ${apiKey}` } } : {}),
				method: "POST",
			});

			if (!response.ok) {
				throw new Error(`Transkription fehlgeschlagen: HTTP ${response.status}`);
			}

			const body = (await response.json()) as { text?: unknown };
			const text = typeof body.text === "string" ? body.text.trim() : "";
			if (!text) {
				throw new Error("Transkription lieferte keinen Text.");
			}
			return {
				providerMetadata: body as Record<string, unknown>,
				text,
			};
		};
	}

	if (protocol === "openrouter") {
		return async ({ data, mediaType }) => {
			const response = await fetch("https://openrouter.ai/api/v1/audio/transcriptions", {
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
			});

			if (!response.ok) {
				throw new Error(`OpenRouter-Transkription fehlgeschlagen: HTTP ${response.status}`);
			}

			const body = (await response.json()) as {
				text?: unknown;
				transcription?: unknown;
			};
			const { text: responseText, transcription } = body;
			let text = "";
			if (typeof responseText === "string") {
				text = responseText;
			} else if (typeof transcription === "string") {
				text = transcription;
			}
			if (!text.trim()) {
				throw new Error("OpenRouter-Transkription lieferte keinen Text.");
			}
			return {
				providerMetadata: {
					openrouter: {
						usage: (body as { usage?: unknown }).usage,
					},
				},
				text: text.trim(),
				usage: (body as { usage?: unknown }).usage,
			};
		};
	}

	return undefined;
};

const buildResolvedModel = async (
	model: AiModelRow,
	provider: AiProviderRow,
): Promise<ResolvedModel> => {
	const apiKey = provider.apiKey ? await decrypt(provider.apiKey) : undefined;

	const languageModel = await createProviderModel(
		provider.protocol,
		model.modelId,
		apiKey,
		provider.baseUrl,
	);
	const transcribeAudio = createAudioTranscriber(
		provider.protocol,
		model.modelId,
		apiKey,
		provider.baseUrl,
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
		where: and(eq(aiModel.providerId, providerId), eq(aiModel.modelId, modelId)),
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
		case "agent": {
			return defaults.defaultAgentModelId;
		}
		case "evaluation": {
			return defaults.defaultEvaluationModel;
		}
		case "file-image": {
			return defaults.defaultFileImageModelId;
		}
		case "speech-to-text": {
			return defaults.defaultSpeechToTextModelId;
		}
		case "text": {
			return defaults.defaultTextModelId;
		}
		default: {
			return null;
		}
	}
};

const getDefaultReasoningEffort = (
	defaults: AiDefaultsRow,
	slot: DefaultModelSlot,
): ReasoningEffort => {
	switch (slot) {
		case "agent": {
			return normalizeReasoningEffort(defaults.defaultAgentReasoningEffort);
		}
		case "evaluation": {
			return normalizeReasoningEffort(defaults.defaultEvaluationReasoningEffort);
		}
		case "file-image": {
			return normalizeReasoningEffort(defaults.defaultFileImageReasoningEffort);
		}
		case "speech-to-text": {
			return normalizeReasoningEffort(defaults.defaultSpeechToTextReasoningEffort);
		}
		case "text": {
			return normalizeReasoningEffort(defaults.defaultTextReasoningEffort);
		}
		default: {
			return "none";
		}
	}
};

const getDefaultTemperature = (defaults: AiDefaultsRow, slot: DefaultModelSlot): number | null => {
	switch (slot) {
		case "agent": {
			return defaults.defaultAgentTemperature ?? null;
		}
		case "evaluation": {
			return defaults.defaultEvaluationTemperature ?? null;
		}
		case "file-image": {
			return defaults.defaultFileImageTemperature ?? null;
		}
		case "speech-to-text": {
			return defaults.defaultSpeechToTextTemperature ?? null;
		}
		case "text": {
			return defaults.defaultTextTemperature ?? null;
		}
		default: {
			return null;
		}
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
		defaultTemperature: getDefaultTemperature(defaults, slot),
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

const normalizeMediaPreprocessStrategy = (
	value: string | null | undefined,
	fallback: MediaPreprocessStrategy,
): MediaPreprocessStrategy =>
	value === "direct" || value === "multimodal" ? value : fallback;

/**
 * Resolves the global model strategy for a generation request.
 *
 * The standard (text) model always produces the final answer. Each media kind
 * is sent natively to the standard model when the admin declared that
 * capability; otherwise it is preprocessed through the dedicated slot model,
 * either via its direct parsing path (STT endpoint, promptless OCR) or as a
 * prompted multimodal request, depending on the configured slot mode.
 */
export const resolveGenerationStrategy = async (
	db: Database,
	options: { hasAudio?: boolean; hasFiles?: boolean },
): Promise<GenerationStrategy> => {
	const defaults = await getDefaults(db);

	const buildAudioPlan = async (): Promise<MediaPlan> => {
		if (defaults.defaultStandardSupportsAudio) {
			return { mode: "native" };
		}
		return {
			mode: "preprocess",
			selection: await buildDefaultSelection(db, defaults, "speech-to-text"),
			strategy: normalizeMediaPreprocessStrategy(defaults.defaultSpeechToTextMode, "direct"),
		};
	};

	const buildFilesPlan = async (): Promise<MediaPlan> => {
		if (defaults.defaultStandardSupportsDocuments) {
			return { mode: "native" };
		}
		return {
			mode: "preprocess",
			selection: await buildDefaultSelection(db, defaults, "file-image"),
			strategy: normalizeMediaPreprocessStrategy(defaults.defaultFileImageMode, "multimodal"),
		};
	};

	const [audio, files, generation] = await Promise.all([
		options.hasAudio ? buildAudioPlan() : Promise.resolve(null),
		options.hasFiles ? buildFilesPlan() : Promise.resolve(null),
		buildDefaultSelection(db, defaults, "text"),
	]);

	return {
		...(audio ? { audio } : {}),
		...(files ? { files } : {}),
		generation,
	};
};

/**
 * Resolves the documentation-agent model. The standard model can explicitly
 * cover the agent; otherwise the dedicated MDScribe Agent slot becomes the
 * generator and declares its own native audio/document capabilities.
 */
export const resolveAgentGenerationStrategy = async (
	db: Database,
	options: { hasAudio?: boolean; hasFiles?: boolean },
): Promise<AgentGenerationStrategy> => {
	const defaults = await getDefaults(db);
	const usesStandardModel = defaults.defaultStandardSupportsAgent;
	const supportsAudio = usesStandardModel
		? defaults.defaultStandardSupportsAudio
		: defaults.defaultAgentSupportsAudio;
	const supportsDocuments = usesStandardModel
		? defaults.defaultStandardSupportsDocuments
		: defaults.defaultAgentSupportsDocuments;

	const buildAudioPlan = async (): Promise<MediaPlan> => {
		if (supportsAudio) {
			return { mode: "native" };
		}
		return {
			mode: "preprocess",
			selection: await buildDefaultSelection(db, defaults, "speech-to-text"),
			strategy: normalizeMediaPreprocessStrategy(defaults.defaultSpeechToTextMode, "direct"),
		};
	};

	const buildFilesPlan = async (): Promise<MediaPlan> => {
		if (supportsDocuments) {
			return { mode: "native" };
		}
		return {
			mode: "preprocess",
			selection: await buildDefaultSelection(db, defaults, "file-image"),
			strategy: normalizeMediaPreprocessStrategy(defaults.defaultFileImageMode, "multimodal"),
		};
	};

	const [generation, audio, files] = await Promise.all([
		buildDefaultSelection(db, defaults, usesStandardModel ? "text" : "agent"),
		options.hasAudio ? buildAudioPlan() : Promise.resolve(null),
		options.hasFiles ? buildFilesPlan() : Promise.resolve(null),
	]);

	return {
		...(audio ? { audio } : {}),
		...(files ? { files } : {}),
		generation,
		usesStandardModel,
	};
};

/**
 * Anthropic expresses reasoning as an absolute thinking-token budget instead
 * of an effort level; these budgets approximate the effort scale used by the
 * other protocols (Anthropic enforces a minimum of 1024).
 */
const ANTHROPIC_THINKING_BUDGET_TOKENS: Record<Exclude<ReasoningEffort, "none">, number> = {
	high: 16_384,
	low: 4096,
	medium: 8192,
	minimal: 2048,
	xhigh: 32_000,
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
}): Record<string, Record<string, JSONValue>> | undefined => {
	const normalizedReasoningEffort = normalizeReasoningEffort(reasoningEffort);
	const effectiveReasoningEffort =
		modelAllowsReasoningOptions(model) && normalizedReasoningEffort !== "none"
			? normalizedReasoningEffort
			: undefined;

	switch (model.providerProtocol) {
		case "openrouter": {
			return {
				openrouter: {
					...(includeUsage ? { usage: { include: true } } : {}),
					...(userId ? { user: userId } : {}),
					...(effectiveReasoningEffort
						? { reasoning: { effort: effectiveReasoningEffort } }
						: {}),
					...(zdr ? { zdr: true } : {}),
				},
			};
		}
		case "openai-compatible":
		case "openai": {
			if (!(effectiveReasoningEffort || userId)) {
				return;
			}
			const optionsKey = model.providerProtocol === "openai" ? "openai" : "openaiCompatible";
			return {
				[optionsKey]: {
					...(userId ? { user: userId } : {}),
					...(effectiveReasoningEffort ? { reasoningEffort: effectiveReasoningEffort } : {}),
				},
			};
		}
		case "anthropic": {
			if (!effectiveReasoningEffort) {
				return;
			}
			return {
				anthropic: {
					thinking: {
						budgetTokens: ANTHROPIC_THINKING_BUDGET_TOKENS[effectiveReasoningEffort],
						type: "enabled" as const,
					},
				},
			};
		}
		default: {
			return undefined;
		}
	}
};
