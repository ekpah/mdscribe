import { ORPCError, type } from "@orpc/server";
import {
	aiDefaults,
	aiModel,
	aiProvider,
	type Database,
	eq,
	inArray,
} from "@repo/database";
import { z } from "zod";

import { decrypt, encrypt } from "@/lib/encryption";
import {
	normalizeOpenAICompatibleBaseUrl,
	normalizeProviderBaseUrl,
	PROVIDER_BASE_URL_ERROR_MESSAGE,
} from "@/lib/openai-compatible";
import { authed } from "@/orpc";
import { requiredAdminMiddleware } from "../middlewares/admin";

const admin = authed.use(requiredAdminMiddleware);

const PROVIDER_PROTOCOLS = [
	"openai-compatible",
	"openrouter",
	"openai",
	"anthropic",
] as const;

type ProviderProtocol = (typeof PROVIDER_PROTOCOLS)[number];
type InputMode = "text" | "audio" | "file" | "image";

interface FetchedProviderModel {
	modelId: string;
	displayName: string;
	supportsReasoning: boolean;
	inputModes: InputMode[];
}

interface ProviderFetchConfig {
	protocol: ProviderProtocol;
	baseUrl: string | null;
	apiKey?: string;
}

const normalizeOptionalBaseUrl = (
	value: string | undefined,
	ctx: z.RefinementCtx,
): string | undefined => {
	if (value === undefined) return undefined;
	const trimmed = value.trim();
	if (!trimmed) return undefined;

	try {
		return normalizeProviderBaseUrl(trimmed);
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
	.optional()
	.transform((value, ctx) => normalizeOptionalBaseUrl(value, ctx));

const updateBaseUrlSchema = z
	.string()
	.nullish()
	.transform((value, ctx) => {
		if (value === null || value === undefined) return value;
		return normalizeOptionalBaseUrl(value, ctx);
	});

function ensureV1BaseUrl(url: string): string {
	const trimmed = normalizeProviderBaseUrl(url).replace(/\/+$/, "");
	if (trimmed.toLowerCase().endsWith("/v1")) {
		return trimmed;
	}
	return `${trimmed}/v1`;
}

function inferInputModesFromModelId(modelId: string): InputMode[] {
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
		id.includes("pdf");
	if (hasImageInput) {
		modes.add("image");
		modes.add("file");
	}

	const hasAudioInput =
		id.includes("audio") ||
		id.includes("whisper") ||
		id.includes("transcribe") ||
		id.includes("asr") ||
		id.includes("speech");
	if (hasAudioInput) {
		modes.add("audio");
	}

	return [...modes];
}

function parseOpenRouterInputModes(modality: string | undefined): InputMode[] {
	const value = modality?.toLowerCase() ?? "";
	const modes = new Set<InputMode>(["text"]);

	if (value.includes("audio")) {
		modes.add("audio");
	}

	if (value.includes("image")) {
		modes.add("image");
		modes.add("file");
	}

	if (value.includes("pdf")) {
		modes.add("file");
	}

	return [...modes];
}

function normalizeInputModes(modes: string[]): InputMode[] {
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
}

function normalizeConfiguredBaseUrl(
	protocol: ProviderProtocol,
	baseUrl: string | undefined | null,
): string | null {
	if (!baseUrl) {
		return null;
	}

	if (protocol === "openai-compatible") {
		return normalizeOpenAICompatibleBaseUrl(baseUrl);
	}

	if (protocol === "openai") {
		return ensureV1BaseUrl(baseUrl);
	}

	return normalizeProviderBaseUrl(baseUrl);
}

function requireConfiguredBaseUrl(
	protocol: ProviderProtocol,
	baseUrl: string | null,
): string {
	if (!baseUrl) {
		throw new ORPCError("BAD_REQUEST", {
			message:
				protocol === "openai-compatible"
					? "OpenAI-kompatible Provider benoetigen eine Base URL"
					: "Provider base URL fehlt",
		});
	}

	return baseUrl;
}

async function fetchProviderModels(
	config: ProviderFetchConfig,
): Promise<FetchedProviderModel[]> {
	const signal = AbortSignal.timeout(15_000);

	if (config.protocol === "openrouter") {
		const headers: Record<string, string> = {};
		if (config.apiKey) {
			headers.Authorization = `Bearer ${config.apiKey}`;
		}

		const response = await fetch("https://openrouter.ai/api/v1/models", {
			headers,
			signal,
		});
		if (!response.ok) {
			throw new ORPCError("BAD_REQUEST", {
				message: `Provider check failed: HTTP ${response.status}`,
			});
		}

		const body = (await response.json()) as {
			data?: Array<{
				id: string;
				name?: string;
				display_name?: string;
				supported_parameters?: string[];
				architecture?: { modality?: string };
			}>;
		};

		return (body.data ?? []).map((model) => ({
			modelId: model.id,
			displayName: model.display_name ?? model.name ?? model.id,
			supportsReasoning: (model.supported_parameters ?? []).includes(
				"reasoning",
			),
			inputModes: parseOpenRouterInputModes(model.architecture?.modality),
		}));
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
			data?: Array<{
				id: string;
				display_name?: string;
			}>;
		};

		return (body.data ?? []).map((model) => ({
			modelId: model.id,
			displayName: model.display_name ?? model.id,
			supportsReasoning: false,
			inputModes: inferInputModesFromModelId(model.id),
		}));
	}

	if (config.protocol === "openai") {
		const baseUrl = config.baseUrl ?? "https://api.openai.com/v1";
		const response = await fetch(`${baseUrl}/models`, {
			headers: config.apiKey
				? { Authorization: `Bearer ${config.apiKey}` }
				: {},
			signal,
		});
		if (!response.ok) {
			throw new ORPCError("BAD_REQUEST", {
				message: `Provider check failed: HTTP ${response.status}`,
			});
		}

		const body = (await response.json()) as {
			data?: Array<{
				id: string;
				display_name?: string;
				name?: string;
			}>;
		};

		return (body.data ?? [])
			.filter(
				(model) => !model.id.includes("embed") && !model.id.includes("tts"),
			)
			.map((model) => ({
				modelId: model.id,
				displayName: model.display_name ?? model.name ?? model.id,
				supportsReasoning: false,
				inputModes: inferInputModesFromModelId(model.id),
			}));
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
		data?: Array<{
			id: string;
			display_name?: string;
			name?: string;
		}>;
	};

	return (body.data ?? []).map((model) => ({
		modelId: model.id,
		displayName: model.display_name ?? model.name ?? model.id,
		supportsReasoning: false,
		inputModes: inferInputModesFromModelId(model.id),
	}));
}

async function syncFetchedModelsForProvider(
	db: Database,
	providerId: string,
	fetchedModels: FetchedProviderModel[],
): Promise<{ inserted: number; updated: number; removed: number }> {
	const deduped = new Map<string, FetchedProviderModel>();
	for (const model of fetchedModels) {
		deduped.set(model.modelId, {
			...model,
			inputModes: normalizeInputModes(model.inputModes),
		});
	}

	const existingModels = await db.query.aiModel.findMany({
		where: eq(aiModel.providerId, providerId),
	});

	const existingByModelId = new Map(
		existingModels.map((model) => [model.modelId, model] as const),
	);

	let inserted = 0;
	let updated = 0;

	for (const model of deduped.values()) {
		const existing = existingByModelId.get(model.modelId);
		if (!existing) {
			await db.insert(aiModel).values({
				id: crypto.randomUUID(),
				providerId,
				modelId: model.modelId,
				displayName: model.displayName,
				supportsReasoning: model.supportsReasoning,
				inputModes: model.inputModes,
			});
			inserted += 1;
			continue;
		}

		const sameDisplayName = existing.displayName === model.displayName;
		const sameSupportsReasoning =
			existing.supportsReasoning === model.supportsReasoning;
		const sameInputModes =
			JSON.stringify([...existing.inputModes].sort()) ===
			JSON.stringify([...model.inputModes].sort());

		if (sameDisplayName && sameSupportsReasoning && sameInputModes) {
			continue;
		}

		await db
			.update(aiModel)
			.set({
				displayName: model.displayName,
				supportsReasoning: model.supportsReasoning,
				inputModes: model.inputModes,
			})
			.where(eq(aiModel.id, existing.id));
		updated += 1;
	}

	const fetchedIds = new Set(deduped.keys());
	const staleModelIds = existingModels
		.filter((model) => !fetchedIds.has(model.modelId))
		.map((model) => model.id);

	if (staleModelIds.length > 0) {
		await db.delete(aiModel).where(inArray(aiModel.id, staleModelIds));
	}

	return {
		inserted,
		updated,
		removed: staleModelIds.length,
	};
}

async function getProviderById(db: Database, id: string) {
	const provider = await db.query.aiProvider.findFirst({
		where: eq(aiProvider.id, id),
	});

	if (!provider) {
		throw new ORPCError("NOT_FOUND", { message: "Provider not found" });
	}

	return provider;
}

// ============ Provider handlers ============

const listProvidersHandler = admin.handler(async ({ context }) => {
	const providers = await context.db.query.aiProvider.findMany({
		with: { models: true },
		orderBy: (provider, { asc }) => asc(provider.name),
	});

	return providers.map((provider) => ({
		...provider,
		hasApiKey: !!provider.apiKey,
		apiKey: undefined,
	}));
});

const previewProviderInput = z.object({
	protocol: z.enum(PROVIDER_PROTOCOLS),
	baseUrl: createBaseUrlSchema,
	apiKey: z.string().optional(),
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
			protocol: parsed.protocol,
			baseUrl,
			apiKey: parsed.apiKey,
		});

		return {
			models,
		};
	});

const createProviderInput = z.object({
	name: z.string().min(1),
	protocol: z.enum(PROVIDER_PROTOCOLS),
	baseUrl: createBaseUrlSchema,
	apiKey: z.string().optional(),
});

const createProviderHandler = admin
	.input(type<z.infer<typeof createProviderInput>>())
	.handler(async ({ input, context }) => {
		const parsed = createProviderInput.parse(input);
		const baseUrl = normalizeConfiguredBaseUrl(parsed.protocol, parsed.baseUrl);
		if (parsed.protocol === "openai-compatible") {
			requireConfiguredBaseUrl(parsed.protocol, baseUrl);
		}

		const models = await fetchProviderModels({
			protocol: parsed.protocol,
			baseUrl,
			apiKey: parsed.apiKey,
		});

		const encryptedApiKey = parsed.apiKey ? await encrypt(parsed.apiKey) : null;

		const [provider] = await context.db
			.insert(aiProvider)
			.values({
				id: crypto.randomUUID(),
				name: parsed.name,
				protocol: parsed.protocol,
				baseUrl,
				apiKey: encryptedApiKey,
			})
			.returning();

		if (!provider) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: "Provider could not be created",
			});
		}

		const syncResult = await syncFetchedModelsForProvider(
			context.db,
			provider.id,
			models,
		);

		return {
			...provider,
			hasApiKey: !!provider.apiKey,
			apiKey: undefined,
			modelCount: models.length,
			syncResult,
		};
	});

const updateProviderInput = z.object({
	id: z.string(),
	name: z.string().min(1).optional(),
	protocol: z.enum(PROVIDER_PROTOCOLS).optional(),
	baseUrl: updateBaseUrlSchema,
	apiKey: z.string().nullish(),
});

const updateProviderHandler = admin
	.input(type<z.infer<typeof updateProviderInput>>())
	.handler(async ({ input, context }) => {
		const parsed = updateProviderInput.parse(input);
		const existing = await getProviderById(context.db, parsed.id);

		const nextProtocol =
			parsed.protocol ?? (existing.protocol as ProviderProtocol);
		const nextBaseUrl =
			parsed.baseUrl === undefined
				? existing.baseUrl
				: normalizeConfiguredBaseUrl(nextProtocol, parsed.baseUrl);
		if (nextProtocol === "openai-compatible") {
			requireConfiguredBaseUrl(nextProtocol, nextBaseUrl);
		}

		let nextApiKeyEncrypted = existing.apiKey;
		let nextApiKeyPlain: string | undefined;
		if (parsed.apiKey === null) {
			nextApiKeyEncrypted = null;
			nextApiKeyPlain = undefined;
		} else if (typeof parsed.apiKey === "string") {
			nextApiKeyEncrypted = await encrypt(parsed.apiKey);
			nextApiKeyPlain = parsed.apiKey;
		} else {
			nextApiKeyPlain = existing.apiKey
				? await decrypt(existing.apiKey)
				: undefined;
		}

		const needsValidation =
			parsed.protocol !== undefined ||
			parsed.baseUrl !== undefined ||
			parsed.apiKey !== undefined;

		let syncResult:
			| { inserted: number; updated: number; removed: number }
			| undefined;
		if (needsValidation) {
			const fetchedModels = await fetchProviderModels({
				protocol: nextProtocol,
				baseUrl: nextBaseUrl,
				apiKey: nextApiKeyPlain,
			});
			syncResult = await syncFetchedModelsForProvider(
				context.db,
				existing.id,
				fetchedModels,
			);
		}

		const [provider] = await context.db
			.update(aiProvider)
			.set({
				name: parsed.name ?? existing.name,
				protocol: nextProtocol,
				baseUrl: nextBaseUrl,
				apiKey: nextApiKeyEncrypted,
			})
			.where(eq(aiProvider.id, parsed.id))
			.returning();

		if (!provider) {
			throw new ORPCError("NOT_FOUND", { message: "Provider not found" });
		}

		return {
			...provider,
			hasApiKey: !!provider.apiKey,
			apiKey: undefined,
			syncResult,
		};
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

		return { success: true };
	});

const refreshProviderModelsHandler = admin
	.input(type<{ id: string }>())
	.handler(async ({ input, context }) => {
		const provider = await getProviderById(context.db, input.id);
		const apiKey = provider.apiKey ? await decrypt(provider.apiKey) : undefined;

		const models = await fetchProviderModels({
			protocol: provider.protocol as ProviderProtocol,
			baseUrl: provider.baseUrl,
			apiKey,
		});
		const syncResult = await syncFetchedModelsForProvider(
			context.db,
			provider.id,
			models,
		);

		return {
			models,
			syncResult,
		};
	});

// ============ Model handlers ============

const createModelInput = z.object({
	providerId: z.string(),
	modelId: z.string().min(1),
	displayName: z.string().min(1),
	supportsReasoning: z.boolean().default(false),
	inputModes: z
		.array(z.enum(["text", "audio", "file", "image"]))
		.default(["text"]),
});

const createModelHandler = admin
	.input(type<z.infer<typeof createModelInput>>())
	.handler(async ({ input, context }) => {
		const parsed = createModelInput.parse(input);
		const [model] = await context.db
			.insert(aiModel)
			.values({
				id: crypto.randomUUID(),
				providerId: parsed.providerId,
				modelId: parsed.modelId,
				displayName: parsed.displayName,
				supportsReasoning: parsed.supportsReasoning,
				inputModes: normalizeInputModes(parsed.inputModes),
			})
			.returning();

		return model;
	});

const updateModelInput = z.object({
	id: z.string(),
	modelId: z.string().min(1).optional(),
	displayName: z.string().min(1).optional(),
	supportsReasoning: z.boolean().optional(),
	inputModes: z.array(z.enum(["text", "audio", "file", "image"])).optional(),
});

const updateModelHandler = admin
	.input(type<z.infer<typeof updateModelInput>>())
	.handler(async ({ input, context }) => {
		const parsed = updateModelInput.parse(input);
		const [model] = await context.db
			.update(aiModel)
			.set({
				modelId: parsed.modelId,
				displayName: parsed.displayName,
				supportsReasoning: parsed.supportsReasoning,
				inputModes: parsed.inputModes
					? normalizeInputModes(parsed.inputModes)
					: undefined,
			})
			.where(eq(aiModel.id, parsed.id))
			.returning();

		if (!model) {
			throw new ORPCError("NOT_FOUND", { message: "Model not found" });
		}

		return model;
	});

const deleteModelHandler = admin
	.input(type<{ id: string }>())
	.handler(async ({ input, context }) => {
		const [model] = await context.db
			.delete(aiModel)
			.where(eq(aiModel.id, input.id))
			.returning();

		if (!model) {
			throw new ORPCError("NOT_FOUND", { message: "Model not found" });
		}

		return { success: true };
	});

// ============ Defaults handlers ============

const getDefaultsHandler = admin.handler(async ({ context }) => {
	const defaults = await context.db.query.aiDefaults.findFirst({
		where: eq(aiDefaults.id, "global"),
	});

	return {
		defaultTextModelId: defaults?.defaultTextModelId ?? null,
		defaultFileImageModelId: defaults?.defaultFileImageModelId ?? null,
		defaultSpeechToTextModelId: defaults?.defaultSpeechToTextModelId ?? null,
	};
});

const setDefaultInput = z.object({
	defaultType: z.enum(["text", "file-image", "speech-to-text"]),
	modelId: z.string().nullable(),
});

const setDefaultHandler = admin
	.input(type<z.infer<typeof setDefaultInput>>())
	.handler(async ({ input, context }) => {
		const parsed = setDefaultInput.parse(input);
		if (parsed.modelId) {
			const existing = await context.db.query.aiModel.findFirst({
				where: eq(aiModel.id, parsed.modelId),
			});
			if (!existing) {
				throw new ORPCError("NOT_FOUND", { message: "Model not found" });
			}
		}

		const current = await context.db.query.aiDefaults.findFirst({
			where: eq(aiDefaults.id, "global"),
		});

		const next = {
			id: "global",
			defaultTextModelId: current?.defaultTextModelId ?? null,
			defaultFileImageModelId: current?.defaultFileImageModelId ?? null,
			defaultSpeechToTextModelId: current?.defaultSpeechToTextModelId ?? null,
			updatedAt: new Date(),
		};

		switch (parsed.defaultType) {
			case "text":
				next.defaultTextModelId = parsed.modelId;
				break;
			case "file-image":
				next.defaultFileImageModelId = parsed.modelId;
				break;
			case "speech-to-text":
				next.defaultSpeechToTextModelId = parsed.modelId;
				break;
		}

		if (current) {
			await context.db
				.update(aiDefaults)
				.set({
					defaultTextModelId: next.defaultTextModelId,
					defaultFileImageModelId: next.defaultFileImageModelId,
					defaultSpeechToTextModelId: next.defaultSpeechToTextModelId,
					updatedAt: next.updatedAt,
				})
				.where(eq(aiDefaults.id, "global"));
		} else {
			await context.db.insert(aiDefaults).values(next);
		}

		return {
			defaultTextModelId: next.defaultTextModelId,
			defaultFileImageModelId: next.defaultFileImageModelId,
			defaultSpeechToTextModelId: next.defaultSpeechToTextModelId,
		};
	});

export const providersHandler = {
	connections: {
		list: listProvidersHandler,
		previewModels: previewProviderHandler,
		create: createProviderHandler,
		update: updateProviderHandler,
		delete: deleteProviderHandler,
		refreshModels: refreshProviderModelsHandler,
	},
	models: {
		create: createModelHandler,
		update: updateModelHandler,
		delete: deleteModelHandler,
	},
	defaults: {
		get: getDefaultsHandler,
		set: setDefaultHandler,
	},
};
