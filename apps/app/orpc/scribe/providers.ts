import "server-only";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { aiDefaults, aiModel, aiProvider, and, eq, userAiProvider } from "@repo/database";
import type { Database } from "@repo/database";
import { database } from "@repo/database/client";
import { experimental_transcribe as transcribe } from "ai";
import type { JSONValue, LanguageModel } from "ai";
import { revalidateTag, unstable_cache } from "next/cache";
import { SecureClient, TinfoilAI, toFile } from "tinfoil";

import { decrypt } from "@/lib/encryption";
import { normalizeOpenAICompatibleBaseUrl } from "@/lib/openai-compatible";
import { USER_MESSAGES } from "@/lib/user-messages";
import type { ReasoningEffort } from "@/orpc/scribe/types";

export type { ReasoningEffort } from "@/orpc/scribe/types";

type ProviderProtocol = typeof aiProvider.$inferSelect.protocol;

export type DefaultModelSlot = "agent" | "file-image" | "speech-to-text" | "text";

export type MediaPreprocessStrategy = "direct" | "multimodal";

export const OPENROUTER_ROUTING_MODES = ["default", "nitro", "floor", "exacto"] as const;
export type OpenRouterRoutingMode = (typeof OPENROUTER_ROUTING_MODES)[number];

const OPENROUTER_ROUTING_MODE_SET = new Set<OpenRouterRoutingMode>(OPENROUTER_ROUTING_MODES);
const OPENROUTER_PROVIDER_SORT: Partial<Record<OpenRouterRoutingMode, string>> = {
	exacto: "exacto",
	floor: "price",
	nitro: "throughput",
};

export const normalizeOpenRouterRoutingMode = (
	value: string | null | undefined,
): OpenRouterRoutingMode =>
	OPENROUTER_ROUTING_MODE_SET.has(value as OpenRouterRoutingMode)
		? (value as OpenRouterRoutingMode)
		: "default";

interface TranscribeAudioInput {
	data: Buffer;
	filename: string;
	mediaType: string;
}

interface TranscribeAudioResult {
	providerMetadata?: Record<string, unknown>;
	text: string;
	usage?: unknown;
}

export interface ResolvedModel {
	credentialSource?: "operator" | "user_byok";
	isOpenRouter: boolean;
	model: LanguageModel;
	modelName: string;
	openRouterRoutingMode: OpenRouterRoutingMode;
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

export interface AgentGenerationStrategy extends GenerationStrategy {
	usesStandardModel: boolean;
}

type AiModelRow = typeof aiModel.$inferSelect;
type AiProviderRow = typeof aiProvider.$inferSelect;
type AiDefaultsRow = typeof aiDefaults.$inferSelect;
interface AiModelProviderRows {
	model: AiModelRow;
	provider: AiProviderRow;
}
interface CachedValue<T> {
	expiresAt: number;
	promise: Promise<T>;
}

const AI_PROVIDER_RESOLUTION_CACHE_TAG = "ai-provider-resolution";
const RESOLUTION_CACHE_REVALIDATE_SECONDS = 60;
const RESOLUTION_CACHE_TTL_MS = RESOLUTION_CACHE_REVALIDATE_SECONDS * 1000;
const isResolutionCacheDisabled = () => process.env.NODE_ENV === "test";

const languageModelCache = new Map<string, CachedValue<LanguageModel>>();

const getProcessCachedValue = <T>(
	cacheKey: string,
	cache: Map<string, CachedValue<T>>,
	load: () => Promise<T>,
): Promise<T> => {
	if (isResolutionCacheDisabled()) {
		return load();
	}

	const now = Date.now();
	const cached = cache.get(cacheKey);
	if (cached && cached.expiresAt > now) {
		return cached.promise;
	}

	const promise = (async () => {
		try {
			return await load();
		} catch (error) {
			cache.delete(cacheKey);
			throw error;
		}
	})();
	cache.set(cacheKey, {
		expiresAt: now + RESOLUTION_CACHE_TTL_MS,
		promise,
	});
	return promise;
};

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

/**
 * Clears every layer of the provider-resolution cache after an admin write.
 *
 * Note the asymmetry: `revalidateTag` purges the Next Data Cache coherently
 * across all instances/containers, but the process-level `Map`s
 * (`languageModelCache`) are only cleared in the *local* process. Other
 * workers keep serving stale `LanguageModel` client objects until their
 * `RESOLUTION_CACHE_TTL_MS` entry expires — so the TTL is the real
 * cross-instance consistency bound for the non-serializable clients.
 * Acceptable because admin config changes are rare; do not assume this call
 * gives read-your-writes semantics cluster-wide.
 */
export const invalidateAiProviderResolutionCaches = (): void => {
	languageModelCache.clear();
	try {
		revalidateTag(AI_PROVIDER_RESOLUTION_CACHE_TAG, "max");
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		const isMissingCacheContext = message.includes("static generation store missing");
		if (
			process.env.NODE_ENV === "test" ||
			(process.env.NODE_ENV !== "production" && isMissingCacheContext)
		) {
			return;
		}

		console.error("Failed to revalidate AI provider resolution cache:", error);
	}
};

/**
 * Tinfoil providers are cached per credential set because `SecureClient`
 * performs the enclave attestation handshake (hardware signature checks plus
 * code provenance) before returning; reusing the instance keeps that cost off
 * the per-request path. Rejected handshakes are evicted so the next request
 * retries instead of caching the failure.
 */
type TinfoilProvider = ReturnType<typeof createOpenAICompatible>;

const tinfoilProviderCache = new Map<string, Promise<TinfoilProvider>>();
const tinfoilTranscriptionClientCache = new Map<string, TinfoilAI>();

const getTinfoilCacheKey = (apiKey: string | undefined, baseUrl: string | null): string =>
	`${apiKey ?? ""}:${baseUrl ?? ""}`;

const createTinfoilProvider = async (
	apiKey: string | undefined,
	baseUrl: string | null,
): Promise<TinfoilProvider> => {
	const resolvedApiKey = apiKey ?? process.env.TINFOIL_API_KEY;
	if (!resolvedApiKey) {
		throw new Error("Tinfoil API key is required");
	}

	const secureClient = new SecureClient(baseUrl ? { baseURL: baseUrl } : {});
	await secureClient.ready();
	const secureBaseUrl = secureClient.getBaseURL();
	if (!secureBaseUrl) {
		throw new Error("Tinfoil secure client did not resolve a base URL");
	}

	// Tinfoil 1.2 uses AI SDK provider protocol v4 internally. MDScribe is
	// currently on AI SDK 6 (provider protocol v3), so compose Tinfoil's
	// public verified transport with the matching OpenAI-compatible adapter.
	return createOpenAICompatible({
		apiKey: resolvedApiKey,
		baseURL: secureBaseUrl,
		fetch: secureClient.fetch,
		name: "tinfoil",
	});
};

const getTinfoilProvider = (
	apiKey: string | undefined,
	baseUrl: string | null,
): Promise<TinfoilProvider> => {
	const cacheKey = getTinfoilCacheKey(apiKey, baseUrl);
	const cached = tinfoilProviderCache.get(cacheKey);
	if (cached) {
		return cached;
	}

	const created = (async () => {
		try {
			return await createTinfoilProvider(apiKey, baseUrl);
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

const createProviderModelUncached = async (
	protocol: string,
	modelId: string,
	apiKey: string | undefined,
	baseUrl: string | null,
	isUserCredential = false,
): Promise<LanguageModel> => {
	switch (protocol) {
		case "openrouter": {
			const provider = createOpenRouter({ apiKey: apiKey ?? "" });
			return provider(modelId);
		}
		case "tinfoil": {
			const provider = isUserCredential
				? await createTinfoilProvider(apiKey, baseUrl)
				: await getTinfoilProvider(apiKey, baseUrl);
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

const createProviderModel = (
	cacheKey: string,
	protocol: string,
	modelId: string,
	apiKey: string | undefined,
	baseUrl: string | null,
): Promise<LanguageModel> =>
	getProcessCachedValue(cacheKey, languageModelCache, () =>
		createProviderModelUncached(protocol, modelId, apiKey, baseUrl),
	);

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
	isUserCredential = false,
): ResolvedModel["transcribeAudio"] | undefined => {
	if (protocol === "tinfoil") {
		return async ({ data, filename, mediaType }) => {
			const client = isUserCredential
				? new TinfoilAI({
						apiKey: apiKey ?? "",
						...(baseUrl ? { baseURL: baseUrl } : {}),
					})
				: getTinfoilTranscriptionClient(apiKey, baseUrl);
			const file = await toFile(data, filename, { type: mediaType });
			const result = await client.audio.transcriptions.create({
				file,
				model: modelId,
			});
			const text = result.text.trim();
			if (!text) {
				throw new Error("Tinfoil-Transkription lieferte keinen Text.");
			}
			return { text };
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
					language: "de",
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
	options?: { db: Database; userId: string },
): Promise<ResolvedModel> => {
	const userCredential =
		options && provider.byokEnabled
			? await options.db.query.userAiProvider.findFirst({
					where: and(
						eq(userAiProvider.providerId, provider.id),
						eq(userAiProvider.userId, options.userId),
						eq(userAiProvider.enabled, true),
					),
				})
			: null;
	const isUserCredential = Boolean(userCredential);
	const encryptedApiKey = userCredential?.apiKey ?? provider.apiKey;
	const apiKey = encryptedApiKey ? await decrypt(encryptedApiKey) : undefined;
	const languageModel = isUserCredential
		? await createProviderModelUncached(
				provider.protocol,
				model.modelId,
				apiKey,
				provider.baseUrl,
				true,
			)
		: await createProviderModel(
				`provider-model:${provider.id}:${model.id}`,
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
		isUserCredential,
	);
	const supportedParameters = normalizeSupportedParameters(model.supportedParameters);

	return {
		credentialSource: isUserCredential ? "user_byok" : "operator",
		isOpenRouter: provider.protocol === "openrouter",
		model: languageModel,
		modelName: model.modelId,
		openRouterRoutingMode: normalizeOpenRouterRoutingMode(model.openRouterRoutingMode),
		providerId: provider.id,
		providerProtocol: provider.protocol,
		supportedParameters,
		supportsReasoning: model.supportsReasoning || supportedParameters.includes("reasoning"),
		...(transcribeAudio ? { transcribeAudio } : {}),
	};
};

const getModelProviderRowsByRecordIdUncached = async (
	modelRecordId: string,
	db: Database,
): Promise<AiModelProviderRows> => {
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

	return row;
};

/**
 * Production (cached) path for model+provider lookup. Uses the singleton
 * `database` import, NOT the caller-supplied `db`, because Next's data cache
 * must only key on serializable arguments. In production `context.db` resolves
 * to this same singleton via `dbProviderMiddleware`, so the two are equivalent.
 *
 * The `db` parameter on the public resolvers is therefore only honored on
 * the *uncached* path (tests, where `NODE_ENV === "test"` disables the cache
 * and injects a fresh per-test database). It is intentionally ignored here.
 */
const getCachedModelProviderRowsByRecordId = unstable_cache(
	(modelRecordId: string): Promise<AiModelProviderRows> =>
		getModelProviderRowsByRecordIdUncached(modelRecordId, database),
	["ai-provider-resolution", "model-provider-by-record-id"],
	{
		revalidate: RESOLUTION_CACHE_REVALIDATE_SECONDS,
		tags: [AI_PROVIDER_RESOLUTION_CACHE_TAG],
	},
);

const getModelProviderRowsByRecordId = (
	modelRecordId: string,
	db: Database,
): Promise<AiModelProviderRows> => {
	if (isResolutionCacheDisabled()) {
		return getModelProviderRowsByRecordIdUncached(modelRecordId, db);
	}

	return getCachedModelProviderRowsByRecordId(modelRecordId);
};

export const resolveModelByRecordId = async (
	modelRecordId: string,
	db: Database,
	userId?: string,
): Promise<ResolvedModel> => {
	const row = await getModelProviderRowsByRecordId(modelRecordId, db);
	return buildResolvedModel(row.model, row.provider, userId ? { db, userId } : undefined);
};

const getModelProviderRowsByProviderModelIdUncached = async (
	providerId: string,
	modelId: string,
	db: Database,
): Promise<AiModelProviderRows> => {
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
		return { model, provider };
	}

	throw new Error(USER_MESSAGES.modelUnavailable);
};

const getCachedModelProviderRowsByProviderModelId = unstable_cache(
	(providerId: string, modelId: string): Promise<AiModelProviderRows> =>
		getModelProviderRowsByProviderModelIdUncached(providerId, modelId, database),
	["ai-provider-resolution", "model-provider-by-provider-model-id"],
	{
		revalidate: RESOLUTION_CACHE_REVALIDATE_SECONDS,
		tags: [AI_PROVIDER_RESOLUTION_CACHE_TAG],
	},
);

const getModelProviderRowsByProviderModelId = (
	providerId: string,
	modelId: string,
	db: Database,
): Promise<AiModelProviderRows> => {
	if (isResolutionCacheDisabled()) {
		return getModelProviderRowsByProviderModelIdUncached(providerId, modelId, db);
	}

	return getCachedModelProviderRowsByProviderModelId(providerId, modelId);
};

const getDefaultsUncached = async (db: Database): Promise<AiDefaultsRow> => {
	const defaults = await db.query.aiDefaults.findFirst({
		where: eq(aiDefaults.id, "global"),
	});

	if (!defaults) {
		throw new Error(USER_MESSAGES.modelUnavailable);
	}

	return defaults;
};

export const resolveProviderModel = async (
	providerId: string,
	modelId: string,
	db: Database,
	userId?: string,
): Promise<ResolvedModel> => {
	const row = await getModelProviderRowsByProviderModelId(providerId, modelId, db);
	return buildResolvedModel(row.model, row.provider, userId ? { db, userId } : undefined);
};

// Defaults are tiny and admin-driven. Do not route them through
// `unstable_cache`: a stale default model can be selected for a long-running
// agent run while its later tool calls resolve the updated model.
const getDefaults = (db: Database): Promise<AiDefaultsRow> => getDefaultsUncached(db);

const getDefaultModelRecordId = (
	defaults: AiDefaultsRow,
	slot: DefaultModelSlot,
): string | null => {
	switch (slot) {
		case "agent": {
			return defaults.defaultAgentModelId;
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
	userId?: string,
): Promise<ResolvedDefaultModelSelection> => {
	const modelRecordId = getDefaultModelRecordId(defaults, slot);
	if (!modelRecordId) {
		throw new Error(USER_MESSAGES.modelUnavailable);
	}

	return {
		defaultTemperature: getDefaultTemperature(defaults, slot),
		model: await resolveModelByRecordId(modelRecordId, db, userId),
		reasoningEffort: getDefaultReasoningEffort(defaults, slot),
		slot,
	};
};

export const resolveDefaultModel = async (
	db: Database,
	slot: DefaultModelSlot,
	userId?: string,
): Promise<ResolvedDefaultModelSelection> => {
	const defaults = await getDefaults(db);
	return buildDefaultSelection(db, defaults, slot, userId);
};

const normalizeMediaPreprocessStrategy = (
	value: string | null | undefined,
	fallback: MediaPreprocessStrategy,
): MediaPreprocessStrategy => (value === "direct" || value === "multimodal" ? value : fallback);

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
	options: { hasAudio?: boolean; hasFiles?: boolean; userId?: string },
): Promise<GenerationStrategy> => {
	const defaults = await getDefaults(db);
	const { userId } = options;

	const buildAudioPlan = async (): Promise<MediaPlan> => {
		if (defaults.defaultStandardSupportsAudio) {
			return { mode: "native" };
		}
		return {
			mode: "preprocess",
			selection: await buildDefaultSelection(db, defaults, "speech-to-text", userId),
			strategy: normalizeMediaPreprocessStrategy(defaults.defaultSpeechToTextMode, "direct"),
		};
	};

	const buildFilesPlan = async (): Promise<MediaPlan> => {
		if (defaults.defaultStandardSupportsDocuments) {
			return { mode: "native" };
		}
		return {
			mode: "preprocess",
			selection: await buildDefaultSelection(db, defaults, "file-image", userId),
			strategy: normalizeMediaPreprocessStrategy(defaults.defaultFileImageMode, "multimodal"),
		};
	};

	const [audio, files, generation] = await Promise.all([
		options.hasAudio ? buildAudioPlan() : Promise.resolve(null),
		options.hasFiles ? buildFilesPlan() : Promise.resolve(null),
		buildDefaultSelection(db, defaults, "text", userId),
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
	options: { hasAudio?: boolean; hasFiles?: boolean; userId?: string },
): Promise<AgentGenerationStrategy> => {
	const defaults = await getDefaults(db);
	const { userId } = options;
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
			selection: await buildDefaultSelection(db, defaults, "speech-to-text", userId),
			strategy: normalizeMediaPreprocessStrategy(defaults.defaultSpeechToTextMode, "direct"),
		};
	};

	const buildFilesPlan = async (): Promise<MediaPlan> => {
		if (supportsDocuments) {
			return { mode: "native" };
		}
		return {
			mode: "preprocess",
			selection: await buildDefaultSelection(db, defaults, "file-image", userId),
			strategy: normalizeMediaPreprocessStrategy(defaults.defaultFileImageMode, "multimodal"),
		};
	};

	const [generation, audio, files] = await Promise.all([
		buildDefaultSelection(db, defaults, usesStandardModel ? "text" : "agent", userId),
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

export const isGenerationStrategyFullyByok = (strategy: GenerationStrategy): boolean => {
	if (strategy.generation.model.credentialSource !== "user_byok") {
		return false;
	}
	for (const plan of [strategy.audio, strategy.files]) {
		if (plan?.mode === "preprocess" && plan.selection.model.credentialSource !== "user_byok") {
			return false;
		}
	}
	return true;
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
	openRouterReasoningEffort,
	reasoningEffort,
	userId,
	zdr,
}: {
	includeUsage?: boolean;
	model: ResolvedModel;
	openRouterReasoningEffort?: ReasoningEffort;
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
			const providerSort = OPENROUTER_PROVIDER_SORT[model.openRouterRoutingMode];
			const resolvedReasoningEffort = effectiveReasoningEffort ?? openRouterReasoningEffort;
			return {
				openrouter: {
					...(providerSort ? { provider: { sort: providerSort } } : {}),
					...(includeUsage ? { usage: { include: true } } : {}),
					...(userId ? { user: userId } : {}),
					...(resolvedReasoningEffort ? { reasoning: { effort: resolvedReasoningEffort } } : {}),
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
