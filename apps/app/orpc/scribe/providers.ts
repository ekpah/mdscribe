import "server-only";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { aiDefaults, aiModel, aiProvider, and, eq } from "@repo/database";
import type { Database } from "@repo/database";
import { experimental_transcribe as transcribe } from "ai";
import type { JSONValue, LanguageModel } from "ai";
import { createTinfoilAI, TinfoilAI, toFile } from "tinfoil";

import { decrypt } from "@/lib/encryption";
import { normalizeOpenAICompatibleBaseUrl } from "@/lib/openai-compatible";
import { USER_MESSAGES } from "@/lib/user-messages";
import type { ReasoningEffort } from "@/orpc/scribe/types";

export type { ReasoningEffort } from "@/orpc/scribe/types";

type ProviderProtocol = typeof aiProvider.$inferSelect.protocol;

export type DefaultModelSlot = "evaluation" | "file-image" | "speech-to-text" | "text";

export type MediaPreprocessStrategy = "direct" | "multimodal";

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

export const normalizeReasoningEffort = (value: string | null | undefined): ReasoningEffort =>
	REASONING_EFFORTS.has(value as ReasoningEffort) ? (value as ReasoningEffort) : "none";

/**
 * Tinfoil providers are cached per credential set because `createTinfoilAI`
 * performs the enclave attestation handshake (hardware signature checks plus
 * code provenance) before returning; reusing the instance keeps that cost off
 * the per-request path. Rejected handshakes are evicted so the next request
 * retries instead of caching the failure.
 */
const tinfoilProviderCache = new Map<string, Promise<Awaited<ReturnType<typeof createTinfoilAI>>>>();
const tinfoilTranscriptionClientCache = new Map<string, TinfoilAI>();

const getTinfoilCacheKey = (apiKey: string | undefined, baseUrl: string | null): string =>
	`${apiKey ?? ""}:${baseUrl ?? ""}`;

const getTinfoilProvider = (
	apiKey: string | undefined,
	baseUrl: string | null,
): Promise<Awaited<ReturnType<typeof createTinfoilAI>>> => {
	const cacheKey = getTinfoilCacheKey(apiKey, baseUrl);
	const cached = tinfoilProviderCache.get(cacheKey);
	if (cached) {
		return cached;
	}

	const created = (async () => {
		try {
			return await createTinfoilAI(apiKey, baseUrl ? { baseURL: baseUrl } : {});
		} catch (error) {
			tinfoilProviderCache.delete(cacheKey);
			throw error;
		}
	})();
	tinfoilProviderCache.set(cacheKey, created);
	return created;
};

const getTinfoilTranscriptionClient = (
	apiKey: string | undefined,
	baseUrl: string | null,
): TinfoilAI => {
	const cacheKey = getTinfoilCacheKey(apiKey, baseUrl);
	const cached = tinfoilTranscriptionClientCache.get(cacheKey);
	if (cached) {
		return cached;
	}

	const client = new TinfoilAI({
		apiKey: apiKey ?? "",
		...(baseUrl ? { baseURL: baseUrl } : {}),
	});
	tinfoilTranscriptionClientCache.set(cacheKey, client);
	return client;
};

const createProviderModel = async (
	protocol: string,
	modelId: string,
	apiKey: string | undefined,
	baseUrl: string | null,
): Promise<LanguageModel> => {
	switch (protocol) {
		case "openrouter": {
			const provider = createOpenRouter({ apiKey: apiKey ?? "" });
			return provider(modelId);
		}
		case "tinfoil": {
			const provider = await getTinfoilProvider(apiKey, baseUrl);
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
	if (protocol === "tinfoil") {
		return async ({ data, filename, mediaType }) => {
			const client = getTinfoilTranscriptionClient(apiKey, baseUrl);
			const file = await toFile(data, filename, { type: mediaType });
			const result = await client.audio.transcriptions.create({
				file,
				model: modelId,
			});
			const text = result.text.trim();
			if (!text) {
				throw new Error("Tinfoil-Transkription lieferte keinen Text.");
			}
			return text;
		};
	}

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
			return text;
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

	return {
		...(options.hasAudio ? { audio: await buildAudioPlan() } : {}),
		...(options.hasFiles ? { files: await buildFilesPlan() } : {}),
		generation: await buildDefaultSelection(db, defaults, "text"),
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
		model.supportsReasoning && normalizedReasoningEffort !== "none"
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
		case "tinfoil":
		case "openai-compatible":
		case "openai": {
			if (!(effectiveReasoningEffort || userId)) {
				return;
			}
			// The generic `openaiCompatible` key applies regardless of the
			// provider's registered name (`tinfoil`, `custom`, ...).
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
