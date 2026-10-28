import { ORPCError, type } from "@orpc/server";
import { aiDefaults, aiModel, aiProvider, eq, inArray, userAiProvider } from "@repo/database";
import type { Database, ModelCost, ModelInput, ModelKind, ProviderOptions } from "@repo/database";
import { z } from "zod";

import { decrypt, encrypt } from "@/lib/encryption";
import {
	isOcrProvider,
	OCR_MODEL_IDS,
	ocrHttpResponseSchema,
	validateOcrResponseBounds,
} from "@/lib/ocr-protocol";
import {
	normalizeOpenAICompatibleBaseUrl,
	normalizeProviderBaseUrl,
	PROVIDER_BASE_URL_ERROR_MESSAGE,
} from "@/lib/openai-compatible";
import { authed } from "@/orpc";
import { requiredAdminMiddleware } from "@/orpc/middlewares/admin";
import { isDecisionProtocol } from "@/orpc/scribe/decisions/client";
import { createPrivatemodeOcrClient } from "@/orpc/scribe/ocr/adapters/privatemode";
import {
	invalidateAiProviderResolutionCaches,
	normalizeOpenRouterRoutingMode,
	OPENROUTER_ROUTING_MODES,
	normalizeReasoningEffort,
} from "@/orpc/scribe/providers";
import type {
	DefaultModelSlot,
	MediaPreprocessStrategy,
	ReasoningEffort,
} from "@/orpc/scribe/providers";

const admin = authed.use(requiredAdminMiddleware);

const PROVIDER_PROTOCOLS = [
	"openai-compatible",
	"openrouter",
	"vercel-ai-gateway",
	"openai",
	"anthropic",
	"tinfoil",
	"workers-ai",
	"ocr-http",
	"mistral-ocr",
	"privatemode-ocr",
] as const;

const TINFOIL_DEFAULT_BASE_URL = "https://inference.tinfoil.sh/v1";

/**
 * Tinfoil model types that can fill the global default slots. Embedding, TTS,
 * tool, safety, and document models are excluded from sync because no slot can
 * use them.
 */
const TINFOIL_SYNCED_MODEL_TYPES = new Set(["chat", "audio"]);

const WORKERS_AI_BASE_URL = "https://api.cloudflare.com/client/v4/accounts/{accountId}/ai/v1";
const WORKERS_AI_CATALOG_PAGE_SIZE = 50;
/**
 * Workers AI lists its System One models under "Text Generation" without a
 * kind marker; they reject chat requests, so only their own slots may use them.
 */
const WORKERS_AI_SYSTEM_ONE_MODELS: Record<string, { cost: ModelCost; kind: ModelKind }> = {
	"@cf/cloudflare/clairic": { cost: { input: 0.1, output: 0 }, kind: "extraction" },
	"@cf/cloudflare/clef": { cost: { input: 0.24, output: 0 }, kind: "decision" },
	"@cf/cloudflare/clef-flash": { cost: { input: 0.038, output: 0 }, kind: "decision" },
};

/**
 * OpenAI's catalog does not mark Decisions API models. These are also chat
 * models, so each gets a second row with kind "decision".
 */
const OPENAI_DECISION_MODELS: Record<string, ModelCost> = {
	"gpt-6-luna": { input: 0.1, output: 0 },
};

/** Model key within a provider: the same model id may be used as chat and decision model. */
const modelKey = (model: { kind?: ModelKind; modelId: string }) =>
	`${model.kind ?? "chat"}:${model.modelId}`;

/** Workers AI keeps the account ID in options so the base URL stays a template. */
const normalizeProviderOptions = (
	protocol: ProviderProtocol,
	options: ProviderOptions | undefined,
): ProviderOptions => {
	if (protocol !== "workers-ai") {
		return options ?? {};
	}
	const accountId = options?.accountId?.trim().toLowerCase() ?? "";
	if (!/^[0-9a-f]{32}$/.test(accountId)) {
		throw new ORPCError("BAD_REQUEST", {
			message: "Workers AI benötigt eine Cloudflare Account-ID",
		});
	}
	return { accountId };
};

export type ProviderProtocol = (typeof PROVIDER_PROTOCOLS)[number];

const normalizeSupportedParameters = (parameters: unknown[] | undefined): string[] =>
	[
		...new Set(
			(parameters ?? [])
				.filter((parameter): parameter is string => typeof parameter === "string")
				.map((parameter) => parameter.trim())
				.filter(Boolean),
		),
	].toSorted();

/** Catalog metadata a provider reports; omitted fields keep the column defaults. */
interface FetchedProviderModel {
	modelId: string;
	displayName: string;
	supportedParameters: string[];
	supportsReasoning: boolean;
	kind?: ModelKind;
	input?: ModelInput[];
	contextWindow?: number;
	maxOutputTokens?: number;
	cost?: ModelCost;
}

interface ProviderFetchConfig {
	protocol: ProviderProtocol;
	baseUrl: string | null;
	apiKey?: string;
	options?: ProviderOptions;
}

const normalizeOptionalBaseUrl = (
	value: string | undefined,
	ctx: z.RefinementCtx,
): string | undefined => {
	if (value === undefined) {
		return undefined;
	}
	const trimmed = value.trim();
	if (!trimmed) {
		return undefined;
	}

	try {
		normalizeProviderBaseUrl(trimmed);
		return trimmed;
	} catch {
		ctx.addIssue({
			code: z.ZodIssueCode.custom,
			message: PROVIDER_BASE_URL_ERROR_MESSAGE,
		});
		return z.NEVER;
	}
};

const createBaseUrlSchema = z
	.string()
	.transform((value, ctx) => normalizeOptionalBaseUrl(value, ctx))
	.optional();

const updateBaseUrlSchema = z
	.string()
	.nullish()
	.transform((value, ctx) => {
		if (value === null || value === undefined) {
			return value;
		}
		return normalizeOptionalBaseUrl(value, ctx);
	});

const ensureV1BaseUrl = (url: string): string => {
	const trimmed = normalizeProviderBaseUrl(url).replace(/\/+$/, "");
	if (trimmed.toLowerCase().endsWith("/v1")) {
		return trimmed;
	}
	return `${trimmed}/v1`;
};

const parseOpenRouterSupportedParameters = (parameters: unknown[] | undefined): string[] =>
	normalizeSupportedParameters(parameters);

const OPENROUTER_INPUTS: Record<string, ModelInput> = {
	audio: "audio",
	file: "document",
	image: "image",
	text: "text",
};

const parseOpenRouterInput = (modalities: string[] | undefined): ModelInput[] | undefined => {
	const input = [...new Set(modalities?.flatMap((modality) => OPENROUTER_INPUTS[modality] ?? []))];
	return input.length > 0 ? input : undefined;
};

/** OpenRouter prices are USD strings per token or per unit; negative means variable (routers). */
const parseOpenRouterCost = (
	pricing: Record<string, string | undefined> | undefined,
): ModelCost | undefined => {
	const price = (key: string, scale = 1) => {
		const value = Number(pricing?.[key]);
		return pricing?.[key] !== undefined && Number.isFinite(value) && value >= 0
			? value * scale
			: undefined;
	};
	const perMillion = 1_000_000;
	const entries = Object.entries({
		cacheRead: price("input_cache_read", perMillion),
		cacheWrite: price("input_cache_write", perMillion),
		image: price("image"),
		input: price("prompt", perMillion),
		output: price("completion", perMillion),
		request: price("request"),
	}).filter(([, value]) => value !== undefined);
	return entries.length > 0 ? Object.fromEntries(entries) : undefined;
};

const parseOpenRouterReasoningSupport = (supportedParameters: string[]): boolean => {
	const parameters = new Set(supportedParameters);
	return parameters.has("reasoning") || parameters.has("include_reasoning");
};

const normalizeConfiguredBaseUrl = (
	protocol: ProviderProtocol,
	baseUrl: string | undefined | null,
): string | null => {
	if (protocol === "privatemode-ocr") {
		return normalizeProviderBaseUrl(baseUrl || "https://api.privatemode.ai");
	}
	if (protocol === "mistral-ocr") {
		return ensureV1BaseUrl(baseUrl || "https://api.mistral.ai/v1");
	}
	if (protocol === "workers-ai") {
		return baseUrl ? normalizeProviderBaseUrl(baseUrl) : WORKERS_AI_BASE_URL;
	}
	if (!baseUrl) {
		return null;
	}

	if (protocol === "ocr-http") {
		const url = new URL(baseUrl);
		if (
			!["http:", "https:"].includes(url.protocol) ||
			url.username ||
			url.password ||
			url.search ||
			url.hash
		) {
			throw new ORPCError("BAD_REQUEST", { message: "Ungültiger OCR-Endpunkt" });
		}
		return url.href;
	}

	if (protocol === "openai-compatible") {
		return normalizeOpenAICompatibleBaseUrl(baseUrl);
	}

	if (protocol === "openai" || protocol === "tinfoil") {
		return ensureV1BaseUrl(baseUrl);
	}

	return normalizeProviderBaseUrl(baseUrl);
};

const requireConfiguredBaseUrl = (protocol: ProviderProtocol, baseUrl: string | null): string => {
	if (!baseUrl) {
		throw new ORPCError("BAD_REQUEST", {
			message:
				protocol === "openai-compatible"
					? "OpenAI-kompatible Provider benoetigen eine Base URL"
					: "Provider base URL fehlt",
		});
	}

	return baseUrl;
};

const fetchTinfoilModels = async (
	config: ProviderFetchConfig,
	signal: AbortSignal,
): Promise<FetchedProviderModel[]> => {
	const baseUrl = config.baseUrl ?? TINFOIL_DEFAULT_BASE_URL;
	const response = await fetch(`${baseUrl}/models`, {
		headers: config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {},
		signal,
	});
	if (!response.ok) {
		throw new ORPCError("BAD_REQUEST", {
			message: `Provider check failed: HTTP ${response.status}`,
		});
	}

	const body = (await response.json()) as {
		data?: {
			id: string;
			display_name?: string;
			name?: string;
			reasoning?: boolean;
			type?: string;
		}[];
	};

	return (body.data ?? [])
		.filter((model) => !model.type || TINFOIL_SYNCED_MODEL_TYPES.has(model.type))
		.map((model) => ({
			displayName: model.display_name ?? model.name ?? model.id,
			modelId: model.id,
			supportedParameters: [],
			supportsReasoning: model.reasoning === true,
		}));
};

const fetchOcrModel = async (config: ProviderFetchConfig): Promise<FetchedProviderModel[]> => {
	const signal = AbortSignal.timeout(15_000);
	const endpoint = requireConfiguredBaseUrl(config.protocol, config.baseUrl);
	// Probe the actual OCR contract with a synthetic blank 64x64 PNG, not /models.
	const image = Buffer.from(
		"iVBORw0KGgoAAAANSUhEUgAAAEAAAABAAQAAAACCEkxzAAAAEklEQVQoz2P4DwUMo4xRBukMAOPT/hB1CzVqAAAAAElFTkSuQmCC",
		"base64",
	);
	const body = new FormData();
	body.append("file", new Blob([image], { type: "image/png" }), "check.png");
	body.append("language", "de");
	const response = await fetch(endpoint, {
		body,
		headers: config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {},
		method: "POST",
		redirect: "error",
		signal,
	});
	if (!response.ok) {
		throw new ORPCError("BAD_REQUEST", { message: `OCR check failed: HTTP ${response.status}` });
	}
	const result = ocrHttpResponseSchema.safeParse(await response.json());
	if (!result.success) {
		throw new ORPCError("BAD_REQUEST", {
			message: "Endpoint does not implement the LiteParse OCR protocol",
		});
	}
	validateOcrResponseBounds(result.data, 64, 64);
	return [
		{
			displayName: "OCR HTTP",
			modelId: "ocr",
			supportedParameters: [],
			supportsReasoning: false,
		},
	];
};

const fetchMistralOcrModel = async (
	config: ProviderFetchConfig,
): Promise<FetchedProviderModel[]> => {
	const signal = AbortSignal.timeout(15_000);
	if (!config.apiKey?.trim()) {
		throw new ORPCError("BAD_REQUEST", { message: "Mistral OCR benötigt einen API-Key" });
	}
	const response = await fetch(
		`${requireConfiguredBaseUrl(config.protocol, config.baseUrl)}/models`,
		{
			headers: { Authorization: `Bearer ${config.apiKey}` },
			signal,
		},
	);
	if (!response.ok) {
		throw new ORPCError("BAD_REQUEST", {
			message: `Mistral provider check failed: HTTP ${response.status}`,
		});
	}
	const body = z
		.object({ data: z.array(z.object({ id: z.string() })) })
		.parse(await response.json());
	if (!body.data.some((model) => model.id === OCR_MODEL_IDS["mistral-ocr"])) {
		throw new ORPCError("BAD_REQUEST", {
			message: "Mistral OCR 4.1 ist für diese Verbindung nicht verfügbar",
		});
	}
	return [
		{
			displayName: "Mistral OCR 4.1",
			modelId: OCR_MODEL_IDS["mistral-ocr"],
			supportedParameters: [],
			supportsReasoning: false,
		},
	];
};

const fetchPrivatemodeOcrModel = async (
	config: ProviderFetchConfig,
): Promise<FetchedProviderModel[]> => {
	const signal = AbortSignal.timeout(15_000);
	const client = await createPrivatemodeOcrClient(
		config.apiKey,
		config.baseUrl ?? "https://api.privatemode.ai",
	);
	try {
		const models = await client.models.list({ signal });
		if (!models.data.some(({ id }) => id === "deepseek-ocr-2")) {
			throw new Error("OCR model unavailable");
		}
		return [
			{
				displayName: "DeepSeek OCR 2 (Privatemode)",
				modelId: "deepseek-ocr-2",
				supportedParameters: [],
				supportsReasoning: false,
			},
		];
	} catch {
		throw new ORPCError("BAD_REQUEST", {
			message: "Privatemode-Prüfung fehlgeschlagen oder DeepSeek OCR 2 nicht verfügbar",
		});
	} finally {
		client.close();
	}
};

const fetchGatewayModels = async (
	config: ProviderFetchConfig,
	signal: AbortSignal,
): Promise<FetchedProviderModel[]> => {
	if (!config.apiKey?.trim()) {
		throw new ORPCError("BAD_REQUEST", {
			message: "Vercel AI Gateway benötigt einen API-Schlüssel",
		});
	}
	const { origin } = new URL(config.baseUrl ?? "https://ai-gateway.vercel.sh");
	const headers = { Authorization: `Bearer ${config.apiKey}` };
	// The model catalog is public, so it cannot validate a candidate key.
	const credits = await fetch(`${origin}/v1/credits`, { headers, signal });
	if (!credits.ok) {
		throw new ORPCError("BAD_REQUEST", {
			message: `Provider check failed: HTTP ${credits.status}`,
		});
	}
	const response = await fetch(`${origin}/v1/models`, { headers, signal });
	if (!response.ok) {
		throw new ORPCError("BAD_REQUEST", {
			message: `Provider check failed: HTTP ${response.status}`,
		});
	}
	const body = (await response.json()) as {
		data?: {
			id: string;
			name?: string;
			type: string;
			tags?: string[];
			supported_parameters?: string[];
		}[];
	};
	return (body.data ?? [])
		.filter((model) => model.type === "language")
		.map((model) => ({
			displayName: model.name ?? model.id,
			modelId: model.id,
			supportedParameters: normalizeSupportedParameters(model.supported_parameters),
			supportsReasoning: model.tags?.includes("reasoning") ?? false,
		}));
};

const fetchWorkersAiModels = async (
	config: ProviderFetchConfig,
	signal: AbortSignal,
): Promise<FetchedProviderModel[]> => {
	const { accountId } = normalizeProviderOptions("workers-ai", config.options);
	const catalogUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/models/search`;
	const models: FetchedProviderModel[] = [];
	for (let page = 1; ; page += 1) {
		const params = new URLSearchParams({
			page: String(page),
			per_page: String(WORKERS_AI_CATALOG_PAGE_SIZE),
			task: "Text Generation",
		});
		// The account catalog requires a token, so it also validates the candidate key.
		const response = await fetch(`${catalogUrl}?${params}`, {
			headers: { Authorization: `Bearer ${config.apiKey ?? ""}` },
			signal,
		});
		if (!response.ok) {
			throw new ORPCError("BAD_REQUEST", {
				message: `Provider check failed: HTTP ${response.status}`,
			});
		}
		const body = (await response.json()) as {
			result?: { name: string; task?: { name: string } }[];
		};
		const result = body.result ?? [];
		for (const model of result) {
			if (model.task?.name === "Text Generation") {
				models.push({
					displayName: model.name,
					...WORKERS_AI_SYSTEM_ONE_MODELS[model.name],
					modelId: model.name,
					supportedParameters: [],
					supportsReasoning: false,
				});
			}
		}
		if (result.length < WORKERS_AI_CATALOG_PAGE_SIZE) {
			return models;
		}
	}
};

export const fetchProviderModels = async (
	config: ProviderFetchConfig,
): Promise<FetchedProviderModel[]> => {
	const signal = AbortSignal.timeout(15_000);
	if (isOcrProvider(config.protocol)) {
		const models = await {
			"mistral-ocr": fetchMistralOcrModel,
			"ocr-http": fetchOcrModel,
			"privatemode-ocr": fetchPrivatemodeOcrModel,
		}[config.protocol](config);
		return models.map((model) => ({
			...model,
			input: ["image", "document"],
			kind: "ocr",
		}));
	}

	const fetchCatalog = {
		tinfoil: fetchTinfoilModels,
		"vercel-ai-gateway": fetchGatewayModels,
		"workers-ai": fetchWorkersAiModels,
	}[config.protocol as string];
	if (fetchCatalog) {
		return fetchCatalog(config, signal);
	}

	if (config.protocol === "openrouter") {
		const headers: Record<string, string> = {};
		if (config.apiKey) {
			headers.Authorization = `Bearer ${config.apiKey}`;
		}

		const response = await fetch("https://openrouter.ai/api/v1/models?output_modalities=all", {
			headers,
			signal,
		});
		if (!response.ok) {
			throw new ORPCError("BAD_REQUEST", {
				message: `Provider check failed: HTTP ${response.status}`,
			});
		}

		const body = (await response.json()) as {
			data?: {
				id: string;
				name?: string;
				display_name?: string;
				supported_parameters?: string[];
				architecture?: { input_modalities?: string[]; output_modalities?: string[] };
				context_length?: number | null;
				top_provider?: { max_completion_tokens?: number | null };
				pricing?: Record<string, string | undefined>;
			}[];
		};

		return (body.data ?? []).map((model) => {
			const supportedParameters = parseOpenRouterSupportedParameters(model.supported_parameters);
			return {
				contextWindow: model.context_length ?? undefined,
				cost: parseOpenRouterCost(model.pricing),
				displayName: model.display_name ?? model.name ?? model.id,
				input: parseOpenRouterInput(model.architecture?.input_modalities),
				kind: model.architecture?.output_modalities?.includes("decisions") ? "decision" : undefined,
				maxOutputTokens: model.top_provider?.max_completion_tokens ?? undefined,
				modelId: model.id,
				supportedParameters,
				supportsReasoning: parseOpenRouterReasoningSupport(supportedParameters),
			};
		});
	}

	if (config.protocol === "anthropic") {
		const response = await fetch("https://api.anthropic.com/v1/models", {
			headers: {
				"anthropic-version": "2023-06-01",
				"x-api-key": config.apiKey ?? "",
			},
			signal,
		});
		if (!response.ok) {
			throw new ORPCError("BAD_REQUEST", {
				message: `Provider check failed: HTTP ${response.status}`,
			});
		}

		const body = (await response.json()) as {
			data?: {
				id: string;
				display_name?: string;
			}[];
		};

		return (body.data ?? []).map((model) => ({
			displayName: model.display_name ?? model.id,
			modelId: model.id,
			supportedParameters: [],
			supportsReasoning: false,
		}));
	}

	if (config.protocol === "openai") {
		const baseUrl = config.baseUrl ?? "https://api.openai.com/v1";
		const response = await fetch(`${baseUrl}/models`, {
			headers: config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {},
			signal,
		});
		if (!response.ok) {
			throw new ORPCError("BAD_REQUEST", {
				message: `Provider check failed: HTTP ${response.status}`,
			});
		}

		const body = (await response.json()) as {
			data?: {
				id: string;
				display_name?: string;
				name?: string;
			}[];
		};

		return (body.data ?? [])
			.filter((model) => !model.id.includes("embed") && !model.id.includes("tts"))
			.flatMap((model): FetchedProviderModel[] => {
				const chat = {
					displayName: model.display_name ?? model.name ?? model.id,
					modelId: model.id,
					supportedParameters: [],
					supportsReasoning: false,
				};
				const decisionCost = OPENAI_DECISION_MODELS[model.id];
				return decisionCost
					? [
							chat,
							{
								...chat,
								cost: decisionCost,
								displayName: `${chat.displayName} (Decisions)`,
								kind: "decision",
							},
						]
					: [chat];
			});
	}

	const baseUrl = requireConfiguredBaseUrl(config.protocol, config.baseUrl);
	const response = await fetch(`${baseUrl}/models`, {
		headers: config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {},
		signal,
	});
	if (!response.ok) {
		throw new ORPCError("BAD_REQUEST", {
			message: `Provider check failed: HTTP ${response.status}`,
		});
	}

	const body = (await response.json()) as {
		data?: {
			id: string;
			display_name?: string;
			name?: string;
		}[];
	};

	return (body.data ?? []).map((model) => ({
		displayName: model.display_name ?? model.name ?? model.id,
		modelId: model.id,
		supportedParameters: [],
		supportsReasoning: false,
	}));
};

const syncFetchedModelsForProvider = async (
	db: Database,
	providerId: string,
	fetchedModels: FetchedProviderModel[],
): Promise<{ inserted: number; updated: number; removed: number }> => {
	const deduped = new Map<string, FetchedProviderModel>();
	for (const model of fetchedModels) {
		const supportedParameters = normalizeSupportedParameters(model.supportedParameters);
		deduped.set(modelKey(model), {
			...model,
			supportedParameters,
			supportsReasoning: model.supportsReasoning || supportedParameters.includes("reasoning"),
		});
	}

	const existingModels = await db.query.aiModel.findMany({
		where: eq(aiModel.providerId, providerId),
	});

	const existingByKey = new Map(existingModels.map((model) => [modelKey(model), model] as const));

	let inserted = 0;
	let updated = 0;

	for (const model of deduped.values()) {
		const values = {
			contextWindow: model.contextWindow ?? null,
			cost: model.cost ?? null,
			displayName: model.displayName,
			input: model.input ?? ["text"],
			kind: model.kind ?? "chat",
			maxOutputTokens: model.maxOutputTokens ?? null,
			supportedParameters: model.supportedParameters,
			supportsReasoning: model.supportsReasoning,
		};
		const existing = existingByKey.get(modelKey(model));
		if (!existing) {
			await db
				.insert(aiModel)
				.values({ ...values, id: crypto.randomUUID(), modelId: model.modelId, providerId });
			inserted += 1;
			continue;
		}

		const unchanged = Object.entries(values).every(
			([key, value]) =>
				JSON.stringify(existing[key as keyof typeof values]) === JSON.stringify(value),
		);
		if (unchanged) {
			continue;
		}

		await db.update(aiModel).set(values).where(eq(aiModel.id, existing.id));
		updated += 1;
	}

	const fetchedIds = new Set(deduped.keys());
	const staleModelIds = existingModels
		.filter((model) => !fetchedIds.has(modelKey(model)))
		.map((model) => model.id);

	if (staleModelIds.length > 0) {
		await db.delete(aiModel).where(inArray(aiModel.id, staleModelIds));
	}

	return {
		inserted,
		removed: staleModelIds.length,
		updated,
	};
};

const getProviderById = async (db: Database, id: string) => {
	const provider = await db.query.aiProvider.findFirst({
		where: eq(aiProvider.id, id),
	});

	if (!provider) {
		throw new ORPCError("NOT_FOUND", { message: "Provider not found" });
	}

	return provider;
};

// ============ Provider handlers ============

const listProvidersHandler = admin.handler(async ({ context }) => {
	const [providers, credentialStates] = await Promise.all([
		context.db.query.aiProvider.findMany({
			orderBy: (provider, { asc }) => asc(provider.name),
			with: { models: true },
		}),
		context.db
			.select({
				enabled: userAiProvider.enabled,
				providerId: userAiProvider.providerId,
			})
			.from(userAiProvider),
	]);
	const credentialCounts = new Map<string, { active: number; stored: number }>();
	for (const credential of credentialStates) {
		const counts = credentialCounts.get(credential.providerId) ?? {
			active: 0,
			stored: 0,
		};
		counts.stored += 1;
		if (credential.enabled) {
			counts.active += 1;
		}
		credentialCounts.set(credential.providerId, counts);
	}

	return providers.map((provider) => {
		const counts = credentialCounts.get(provider.id) ?? {
			active: 0,
			stored: 0,
		};
		return {
			...provider,
			apiKey: undefined,
			byokCredentialCounts: {
				active: provider.byokEnabled ? counts.active : 0,
				stored: counts.stored,
			},
			hasApiKey: !!provider.apiKey,
			models: provider.models.map((model) => {
				const supportedParameters = normalizeSupportedParameters(model.supportedParameters);
				return {
					...model,
					supportedParameters,
					supportsReasoning: model.supportsReasoning || supportedParameters.includes("reasoning"),
				};
			}),
		};
	});
});

const providerOptionsSchema = z.record(z.string(), z.string()).optional();

const previewProviderInput = z.object({
	apiKey: z.string().optional(),
	baseUrl: createBaseUrlSchema,
	options: providerOptionsSchema,
	protocol: z.enum(PROVIDER_PROTOCOLS),
});

const previewProviderHandler = admin
	.input(type<z.infer<typeof previewProviderInput>>())
	.handler(async ({ input }) => {
		const parsed = previewProviderInput.parse(input);
		const baseUrl = normalizeConfiguredBaseUrl(parsed.protocol, parsed.baseUrl);
		if (parsed.protocol === "openai-compatible") {
			requireConfiguredBaseUrl(parsed.protocol, baseUrl);
		}
		const models = await fetchProviderModels({
			apiKey: parsed.apiKey,
			baseUrl,
			options: normalizeProviderOptions(parsed.protocol, parsed.options),
			protocol: parsed.protocol,
		});

		return {
			models,
		};
	});

const createProviderInput = z.object({
	apiKey: z.string().optional(),
	baseUrl: createBaseUrlSchema,
	name: z.string().min(1),
	options: providerOptionsSchema,
	protocol: z.enum(PROVIDER_PROTOCOLS),
});

const createProviderHandler = admin
	.input(type<z.infer<typeof createProviderInput>>())
	.handler(async ({ input, context }) => {
		const parsed = createProviderInput.parse(input);
		const baseUrl = normalizeConfiguredBaseUrl(parsed.protocol, parsed.baseUrl);
		if (parsed.protocol === "openai-compatible") {
			requireConfiguredBaseUrl(parsed.protocol, baseUrl);
		}

		const options = normalizeProviderOptions(parsed.protocol, parsed.options);
		const models = await fetchProviderModels({
			apiKey: parsed.apiKey,
			baseUrl,
			options,
			protocol: parsed.protocol,
		});

		const encryptedApiKey = parsed.apiKey ? await encrypt(parsed.apiKey) : null;

		const [provider] = await context.db
			.insert(aiProvider)
			.values({
				apiKey: encryptedApiKey,
				baseUrl,
				id: crypto.randomUUID(),
				name: parsed.name,
				options,
				protocol: parsed.protocol,
			})
			.returning();

		if (!provider) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: "Provider could not be created",
			});
		}

		const syncResult = await syncFetchedModelsForProvider(context.db, provider.id, models);
		invalidateAiProviderResolutionCaches();

		return {
			...provider,
			apiKey: undefined,
			hasApiKey: !!provider.apiKey,
			modelCount: models.length,
			syncResult,
		};
	});

const updateProviderInput = z.object({
	apiKey: z.string().nullish(),
	baseUrl: updateBaseUrlSchema,
	id: z.string(),
	name: z.string().min(1).optional(),
	options: providerOptionsSchema,
	protocol: z.enum(PROVIDER_PROTOCOLS).optional(),
});

const updateProviderHandler = admin
	.input(type<z.infer<typeof updateProviderInput>>())
	.handler(async ({ input, context }) => {
		const parsed = updateProviderInput.parse(input);
		const existing = await getProviderById(context.db, parsed.id);

		const nextProtocol = parsed.protocol ?? (existing.protocol as ProviderProtocol);
		if (
			nextProtocol !== existing.protocol &&
			(isOcrProvider(nextProtocol) || isOcrProvider(existing.protocol))
		) {
			throw new ORPCError("BAD_REQUEST", {
				message: "Für einen Wechsel zwischen OCR und LLM bitte einen neuen Provider anlegen.",
			});
		}
		const nextBaseUrl =
			parsed.baseUrl === undefined
				? existing.baseUrl
				: normalizeConfiguredBaseUrl(nextProtocol, parsed.baseUrl);
		if (nextProtocol === "openai-compatible") {
			requireConfiguredBaseUrl(nextProtocol, nextBaseUrl);
		}
		const nextOptions = normalizeProviderOptions(nextProtocol, parsed.options ?? existing.options);

		let nextApiKeyEncrypted = existing.apiKey;
		let nextApiKeyPlain: string | undefined;
		if (parsed.apiKey === null) {
			nextApiKeyEncrypted = null;
			nextApiKeyPlain = undefined;
		} else if (typeof parsed.apiKey === "string") {
			nextApiKeyEncrypted = await encrypt(parsed.apiKey);
			nextApiKeyPlain = parsed.apiKey;
		} else {
			nextApiKeyPlain = existing.apiKey ? await decrypt(existing.apiKey) : undefined;
		}

		const needsValidation =
			parsed.protocol !== undefined ||
			parsed.baseUrl !== undefined ||
			parsed.options !== undefined ||
			parsed.apiKey !== undefined;

		let syncResult: { inserted: number; updated: number; removed: number } | undefined;
		if (needsValidation) {
			const fetchedModels = await fetchProviderModels({
				apiKey: nextApiKeyPlain,
				baseUrl: nextBaseUrl,
				options: nextOptions,
				protocol: nextProtocol,
			});
			syncResult = await syncFetchedModelsForProvider(context.db, existing.id, fetchedModels);
		}

		const [provider] = await context.db
			.update(aiProvider)
			.set({
				apiKey: nextApiKeyEncrypted,
				baseUrl: nextBaseUrl,
				name: parsed.name ?? existing.name,
				options: nextOptions,
				protocol: nextProtocol,
			})
			.where(eq(aiProvider.id, parsed.id))
			.returning();

		if (!provider) {
			throw new ORPCError("NOT_FOUND", { message: "Provider not found" });
		}
		if (
			parsed.protocol !== undefined ||
			parsed.baseUrl !== undefined ||
			parsed.options !== undefined
		) {
			await context.db
				.update(userAiProvider)
				.set({ enabled: false })
				.where(eq(userAiProvider.providerId, provider.id));
		}
		invalidateAiProviderResolutionCaches();

		return {
			...provider,
			apiKey: undefined,
			hasApiKey: !!provider.apiKey,
			syncResult,
		};
	});

const setProviderByokEnabledInput = z.object({
	enabled: z.boolean(),
	id: z.string(),
});

const setProviderByokEnabledHandler = admin
	.input(type<z.infer<typeof setProviderByokEnabledInput>>())
	.handler(async ({ input, context }) => {
		const parsed = setProviderByokEnabledInput.parse(input);
		const existing = await getProviderById(context.db, parsed.id);
		if (parsed.enabled && isOcrProvider(existing.protocol)) {
			throw new ORPCError("BAD_REQUEST", { message: "BYOK ist für OCR HTTP nicht verfügbar" });
		}
		// A user's Cloudflare token belongs to their own account, but the account ID is the operator's.
		if (parsed.enabled && existing.protocol === "workers-ai") {
			throw new ORPCError("BAD_REQUEST", { message: "BYOK ist für Workers AI nicht verfügbar" });
		}
		const [provider] = await context.db
			.update(aiProvider)
			.set({ byokEnabled: parsed.enabled })
			.where(eq(aiProvider.id, parsed.id))
			.returning({
				byokEnabled: aiProvider.byokEnabled,
				id: aiProvider.id,
			});

		if (!provider) {
			throw new ORPCError("NOT_FOUND", { message: "Provider not found" });
		}
		invalidateAiProviderResolutionCaches();
		return provider;
	});

const deleteProviderHandler = admin
	.input(type<{ id: string }>())
	.handler(async ({ input, context }) => {
		const [provider] = await context.db
			.delete(aiProvider)
			.where(eq(aiProvider.id, input.id))
			.returning();

		if (!provider) {
			throw new ORPCError("NOT_FOUND", { message: "Provider not found" });
		}
		invalidateAiProviderResolutionCaches();

		return { success: true };
	});

const refreshProviderModelsHandler = admin
	.input(type<{ id: string }>())
	.handler(async ({ input, context }) => {
		const provider = await getProviderById(context.db, input.id);
		const apiKey = provider.apiKey ? await decrypt(provider.apiKey) : undefined;

		const models = await fetchProviderModels({
			apiKey,
			baseUrl: provider.baseUrl,
			options: provider.options,
			protocol: provider.protocol as ProviderProtocol,
		});
		const syncResult = await syncFetchedModelsForProvider(context.db, provider.id, models);
		invalidateAiProviderResolutionCaches();

		return {
			models,
			syncResult,
		};
	});

// ============ Model handlers ============

const createModelInput = z.object({
	displayName: z.string().min(1),
	modelId: z.string().min(1),
	providerId: z.string(),
	supportedParameters: z.array(z.string()).default([]),
	supportsReasoning: z.boolean().default(false),
});

const createModelHandler = admin
	.input(type<z.infer<typeof createModelInput>>())
	.handler(async ({ input, context }) => {
		const parsed = createModelInput.parse(input);
		const provider = await getProviderById(context.db, parsed.providerId);
		if (isOcrProvider(provider.protocol)) {
			throw new ORPCError("BAD_REQUEST", {
				message: "OCR HTTP stellt genau einen OCR-Endpunkt bereit",
			});
		}
		const supportedParameters = normalizeSupportedParameters(parsed.supportedParameters);
		const [model] = await context.db
			.insert(aiModel)
			.values({
				displayName: parsed.displayName,
				id: crypto.randomUUID(),
				modelId: parsed.modelId,
				providerId: parsed.providerId,
				supportedParameters,
				supportsReasoning: parsed.supportsReasoning || supportedParameters.includes("reasoning"),
			})
			.returning();
		invalidateAiProviderResolutionCaches();

		return model;
	});

const updateModelInput = z.object({
	displayName: z.string().min(1).optional(),
	id: z.string(),
	modelId: z.string().min(1).optional(),
	openRouterRoutingMode: z.enum(OPENROUTER_ROUTING_MODES).optional(),
	supportedParameters: z.array(z.string()).optional(),
	supportsReasoning: z.boolean().optional(),
});

const updateModelHandler = admin
	.input(type<z.infer<typeof updateModelInput>>())
	.handler(async ({ input, context }) => {
		const parsed = updateModelInput.parse(input);
		const existing = await context.db.query.aiModel.findFirst({
			where: eq(aiModel.id, parsed.id),
			with: { provider: true },
		});
		if (!existing) {
			throw new ORPCError("NOT_FOUND", { message: "Model not found" });
		}
		if (
			isOcrProvider(existing.provider.protocol) &&
			parsed.modelId !== undefined &&
			parsed.modelId !== OCR_MODEL_IDS[existing.provider.protocol]
		) {
			throw new ORPCError("BAD_REQUEST", {
				message: "Die OCR-Endpunkt-ID kann nicht geändert werden",
			});
		}
		if (parsed.openRouterRoutingMode !== undefined && existing.provider.protocol !== "openrouter") {
			throw new ORPCError("BAD_REQUEST", {
				message: "Routing-Einstellungen sind nur für OpenRouter verfügbar",
			});
		}
		const supportedParameters = parsed.supportedParameters
			? normalizeSupportedParameters(parsed.supportedParameters)
			: undefined;
		const [model] = await context.db
			.update(aiModel)
			.set({
				displayName: parsed.displayName,
				modelId: parsed.modelId,
				options:
					parsed.openRouterRoutingMode === undefined
						? undefined
						: {
								...existing.options,
								openRouterRoutingMode: normalizeOpenRouterRoutingMode(parsed.openRouterRoutingMode),
							},
				supportedParameters,
				supportsReasoning:
					parsed.supportsReasoning ??
					(supportedParameters ? supportedParameters.includes("reasoning") : undefined),
			})
			.where(eq(aiModel.id, parsed.id))
			.returning();

		invalidateAiProviderResolutionCaches();

		return model;
	});

const deleteModelHandler = admin
	.input(type<{ id: string }>())
	.handler(async ({ input, context }) => {
		const [model] = await context.db.delete(aiModel).where(eq(aiModel.id, input.id)).returning();

		if (!model) {
			throw new ORPCError("NOT_FOUND", { message: "Model not found" });
		}
		invalidateAiProviderResolutionCaches();

		return { success: true };
	});

// ============ Defaults handlers ============

const MEDIA_PREPROCESS_MODES = [
	"direct",
	"multimodal",
] as const satisfies readonly MediaPreprocessStrategy[];

const normalizeMediaMode = (
	value: string | null | undefined,
	fallback: MediaPreprocessStrategy,
): MediaPreprocessStrategy => (value === "direct" || value === "multimodal" ? value : fallback);

const buildDefaultsResponse = (defaults: Partial<typeof aiDefaults.$inferSelect> | undefined) => {
	const d: Partial<typeof aiDefaults.$inferSelect> = defaults ?? {};
	return {
		defaultAgentModelId: d.defaultAgentModelId ?? null,
		defaultAgentReasoningEffort: normalizeReasoningEffort(d.defaultAgentReasoningEffort),
		defaultAgentSupportsAudio: d.defaultAgentSupportsAudio ?? false,
		defaultAgentSupportsDocuments: d.defaultAgentSupportsDocuments ?? false,
		defaultAgentTemperature: d.defaultAgentTemperature ?? null,
		defaultDecisionModelId: d.defaultDecisionModelId ?? null,
		defaultFileImageModelId: d.defaultFileImageModelId ?? null,
		defaultFileImageReasoningEffort: normalizeReasoningEffort(d.defaultFileImageReasoningEffort),
		defaultFileImageTemperature: d.defaultFileImageTemperature ?? null,
		defaultSpeechToTextMode: normalizeMediaMode(d.defaultSpeechToTextMode, "direct"),
		defaultSpeechToTextModelId: d.defaultSpeechToTextModelId ?? null,
		defaultSpeechToTextReasoningEffort: normalizeReasoningEffort(
			d.defaultSpeechToTextReasoningEffort,
		),
		defaultSpeechToTextTemperature: d.defaultSpeechToTextTemperature ?? null,
		defaultStandardSupportsAgent: d.defaultStandardSupportsAgent ?? false,
		defaultStandardSupportsAudio: d.defaultStandardSupportsAudio ?? false,
		defaultStandardSupportsDocuments: d.defaultStandardSupportsDocuments ?? false,
		defaultTextModelId: d.defaultTextModelId ?? null,
		defaultTextReasoningEffort: normalizeReasoningEffort(d.defaultTextReasoningEffort),
		defaultTextTemperature: d.defaultTextTemperature ?? null,
	};
};

const getDefaultsHandler = admin.handler(async ({ context }) => {
	const defaults = await context.db.query.aiDefaults.findFirst({
		where: eq(aiDefaults.id, "global"),
	});

	return buildDefaultsResponse(defaults);
});

// "decision" is not a generation slot: it has no reasoning or temperature settings.
const DEFAULT_MODEL_SLOTS = [
	"agent",
	"text",
	"file-image",
	"speech-to-text",
	"decision",
] as const satisfies readonly (DefaultModelSlot | "decision")[];

const REASONING_EFFORT_VALUES = [
	"none",
	"minimal",
	"low",
	"medium",
	"high",
	"xhigh",
] as const satisfies readonly ReasoningEffort[];

const reasoningEffortSchema = z.enum(REASONING_EFFORT_VALUES);

const setDefaultInput = z.object({
	defaultType: z.enum(DEFAULT_MODEL_SLOTS),
	modelId: z.string().nullable(),
	reasoningEffort: reasoningEffortSchema.optional(),
	temperature: z.number().min(0).max(2).nullable().optional(),
});

type AiDefaultsDraft = typeof aiDefaults.$inferInsert;

const buildAiDefaultsDraft = (
	current: typeof aiDefaults.$inferSelect | undefined,
): AiDefaultsDraft => {
	const c: Partial<typeof aiDefaults.$inferSelect> = current ?? {};
	return {
		defaultAgentModelId: c.defaultAgentModelId ?? null,
		defaultAgentReasoningEffort: normalizeReasoningEffort(c.defaultAgentReasoningEffort),
		defaultAgentSupportsAudio: c.defaultAgentSupportsAudio ?? false,
		defaultAgentSupportsDocuments: c.defaultAgentSupportsDocuments ?? false,
		defaultAgentTemperature: c.defaultAgentTemperature ?? null,
		defaultDecisionModelId: c.defaultDecisionModelId ?? null,
		defaultFileImageMode: normalizeMediaMode(c.defaultFileImageMode, "multimodal"),
		defaultFileImageModelId: c.defaultFileImageModelId ?? null,
		defaultFileImageReasoningEffort: normalizeReasoningEffort(c.defaultFileImageReasoningEffort),
		defaultFileImageTemperature: c.defaultFileImageTemperature ?? null,
		defaultSpeechToTextMode: normalizeMediaMode(c.defaultSpeechToTextMode, "direct"),
		defaultSpeechToTextModelId: c.defaultSpeechToTextModelId ?? null,
		defaultSpeechToTextReasoningEffort: normalizeReasoningEffort(
			c.defaultSpeechToTextReasoningEffort,
		),
		defaultSpeechToTextTemperature: c.defaultSpeechToTextTemperature ?? null,
		defaultStandardSupportsAgent: c.defaultStandardSupportsAgent ?? false,
		defaultStandardSupportsAudio: c.defaultStandardSupportsAudio ?? false,
		defaultStandardSupportsDocuments: c.defaultStandardSupportsDocuments ?? false,
		defaultTextModelId: c.defaultTextModelId ?? null,
		defaultTextReasoningEffort: normalizeReasoningEffort(c.defaultTextReasoningEffort),
		defaultTextTemperature: c.defaultTextTemperature ?? null,
		id: "global",
		updatedAt: new Date(),
	};
};

const persistAiDefaultsDraft = async (db: Database, hasCurrent: boolean, next: AiDefaultsDraft) => {
	await (hasCurrent
		? db
				.update(aiDefaults)
				.set({
					defaultAgentModelId: next.defaultAgentModelId,
					defaultAgentReasoningEffort: next.defaultAgentReasoningEffort,
					defaultAgentSupportsAudio: next.defaultAgentSupportsAudio,
					defaultAgentSupportsDocuments: next.defaultAgentSupportsDocuments,
					defaultAgentTemperature: next.defaultAgentTemperature,
					defaultDecisionModelId: next.defaultDecisionModelId,
					defaultFileImageMode: next.defaultFileImageMode,
					defaultFileImageModelId: next.defaultFileImageModelId,
					defaultFileImageReasoningEffort: next.defaultFileImageReasoningEffort,
					defaultFileImageTemperature: next.defaultFileImageTemperature,
					defaultSpeechToTextMode: next.defaultSpeechToTextMode,
					defaultSpeechToTextModelId: next.defaultSpeechToTextModelId,
					defaultSpeechToTextReasoningEffort: next.defaultSpeechToTextReasoningEffort,
					defaultSpeechToTextTemperature: next.defaultSpeechToTextTemperature,
					defaultStandardSupportsAgent: next.defaultStandardSupportsAgent,
					defaultStandardSupportsAudio: next.defaultStandardSupportsAudio,
					defaultStandardSupportsDocuments: next.defaultStandardSupportsDocuments,
					defaultTextModelId: next.defaultTextModelId,
					defaultTextReasoningEffort: next.defaultTextReasoningEffort,
					defaultTextTemperature: next.defaultTextTemperature,
					updatedAt: next.updatedAt,
				})
				.where(eq(aiDefaults.id, "global"))
		: db.insert(aiDefaults).values(next));
};

const applyDefaultSelection = (next: AiDefaultsDraft, parsed: z.infer<typeof setDefaultInput>) => {
	const nextReasoningEffort = parsed.reasoningEffort;
	const nextTemperature = parsed.temperature;
	switch (parsed.defaultType) {
		case "agent": {
			next.defaultAgentModelId = parsed.modelId;
			if (nextReasoningEffort !== undefined) {
				next.defaultAgentReasoningEffort = nextReasoningEffort;
			}
			if (nextTemperature !== undefined) {
				next.defaultAgentTemperature = nextTemperature;
			}
			break;
		}
		case "text": {
			next.defaultTextModelId = parsed.modelId;
			if (nextReasoningEffort !== undefined) {
				next.defaultTextReasoningEffort = nextReasoningEffort;
			}
			if (nextTemperature !== undefined) {
				next.defaultTextTemperature = nextTemperature;
			}
			break;
		}
		case "file-image": {
			next.defaultFileImageModelId = parsed.modelId;
			if (nextReasoningEffort !== undefined) {
				next.defaultFileImageReasoningEffort = nextReasoningEffort;
			}
			if (nextTemperature !== undefined) {
				next.defaultFileImageTemperature = nextTemperature;
			}
			break;
		}
		case "speech-to-text": {
			next.defaultSpeechToTextModelId = parsed.modelId;
			if (nextReasoningEffort !== undefined) {
				next.defaultSpeechToTextReasoningEffort = nextReasoningEffort;
			}
			if (nextTemperature !== undefined) {
				next.defaultSpeechToTextTemperature = nextTemperature;
			}
			break;
		}
		case "decision": {
			next.defaultDecisionModelId = parsed.modelId;
			break;
		}
		default: {
			throw new ORPCError("BAD_REQUEST", {
				message: "Ungültiger Standardtyp",
			});
		}
	}
};

const setDefaultHandler = admin
	.input(type<z.infer<typeof setDefaultInput>>())
	.handler(async ({ input, context }) => {
		const parsed = setDefaultInput.parse(input);
		if (parsed.modelId) {
			const existing = await context.db.query.aiModel.findFirst({
				where: eq(aiModel.id, parsed.modelId),
				with: { provider: true },
			});
			if (!existing) {
				throw new ORPCError("NOT_FOUND", { message: "Model not found" });
			}
			if (isOcrProvider(existing.provider.protocol) && parsed.defaultType !== "file-image") {
				throw new ORPCError("BAD_REQUEST", {
					message: "OCR HTTP kann nur als Dokumenten-Modell verwendet werden",
				});
			}
			if (parsed.defaultType === "decision") {
				if (existing.kind !== "decision" || !isDecisionProtocol(existing.provider.protocol)) {
					throw new ORPCError("BAD_REQUEST", {
						message: "Als Entscheidungsmodell ist nur ein Decisions-Modell möglich",
					});
				}
			} else if (existing.kind !== "chat" && existing.kind !== "ocr") {
				throw new ORPCError("BAD_REQUEST", {
					message: "Entscheidungs- und Extraktionsmodelle können keine Chat-Slots belegen",
				});
			}
		}

		const current = await context.db.query.aiDefaults.findFirst({
			where: eq(aiDefaults.id, "global"),
		});

		const next = buildAiDefaultsDraft(current);
		applyDefaultSelection(next, parsed);

		await persistAiDefaultsDraft(context.db, Boolean(current), next);
		invalidateAiProviderResolutionCaches();

		return buildDefaultsResponse(next);
	});

const setDefaultOptionsInput = z.object({
	agentSupportsAudio: z.boolean().optional(),
	agentSupportsDocuments: z.boolean().optional(),
	speechToTextMode: z.enum(MEDIA_PREPROCESS_MODES).optional(),
	standardSupportsAgent: z.boolean().optional(),
	standardSupportsAudio: z.boolean().optional(),
	standardSupportsDocuments: z.boolean().optional(),
});

const setDefaultOptionsHandler = admin
	.input(type<z.infer<typeof setDefaultOptionsInput>>())
	.handler(async ({ input, context }) => {
		const parsed = setDefaultOptionsInput.parse(input);

		const current = await context.db.query.aiDefaults.findFirst({
			where: eq(aiDefaults.id, "global"),
		});

		const next = buildAiDefaultsDraft(current);
		if (parsed.agentSupportsAudio !== undefined) {
			next.defaultAgentSupportsAudio = parsed.agentSupportsAudio;
		}
		if (parsed.agentSupportsDocuments !== undefined) {
			next.defaultAgentSupportsDocuments = parsed.agentSupportsDocuments;
		}
		if (parsed.speechToTextMode !== undefined) {
			next.defaultSpeechToTextMode = parsed.speechToTextMode;
		}
		if (parsed.standardSupportsAgent !== undefined) {
			next.defaultStandardSupportsAgent = parsed.standardSupportsAgent;
		}
		if (parsed.standardSupportsAudio !== undefined) {
			next.defaultStandardSupportsAudio = parsed.standardSupportsAudio;
		}
		if (parsed.standardSupportsDocuments !== undefined) {
			next.defaultStandardSupportsDocuments = parsed.standardSupportsDocuments;
		}

		await persistAiDefaultsDraft(context.db, Boolean(current), next);
		invalidateAiProviderResolutionCaches();

		return buildDefaultsResponse(next);
	});

export const providersHandler = {
	connections: {
		create: createProviderHandler,
		delete: deleteProviderHandler,
		list: listProvidersHandler,
		previewModels: previewProviderHandler,
		refreshModels: refreshProviderModelsHandler,
		setByokEnabled: setProviderByokEnabledHandler,
		update: updateProviderHandler,
	},
	defaults: {
		get: getDefaultsHandler,
		set: setDefaultHandler,
		setOptions: setDefaultOptionsHandler,
	},
	models: {
		create: createModelHandler,
		delete: deleteModelHandler,
		update: updateModelHandler,
	},
};
