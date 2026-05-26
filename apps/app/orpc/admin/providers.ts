import { ORPCError, type } from "@orpc/server";
import { aiDefaults, aiModel, aiProvider, eq, inArray } from "@repo/database";
import type { Database } from "@repo/database";
import { z } from "zod";

import {
	inferInputModesFromModelId,
	normalizeInputModes,
	resolveInputModes,
	type InputMode,
} from "@/lib/ai-model-input-modes";
import { decrypt, encrypt } from "@/lib/encryption";
import {
	normalizeOpenAICompatibleBaseUrl,
	normalizeProviderBaseUrl,
	PROVIDER_BASE_URL_ERROR_MESSAGE,
} from "@/lib/openai-compatible";
import { authed } from "@/orpc";
import { requiredAdminMiddleware } from "@/orpc/middlewares/admin";

const admin = authed.use(requiredAdminMiddleware);

const PROVIDER_PROTOCOLS = ["openai-compatible", "openrouter", "openai", "anthropic"] as const;

type ProviderProtocol = (typeof PROVIDER_PROTOCOLS)[number];

const normalizeSupportedParameters = (parameters: unknown[] | undefined): string[] =>
	Array.from(
		new Set(
			(parameters ?? [])
				.filter((parameter): parameter is string => typeof parameter === "string")
				.map((parameter) => parameter.trim())
				.filter(Boolean),
		),
	).toSorted();

interface FetchedProviderModel {
	modelId: string;
	displayName: string;
	supportedParameters: string[];
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
	if (value === undefined) {
		return undefined;
	}
	const trimmed = value.trim();
	if (!trimmed) {
		return undefined;
	}

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

const parseOpenRouterInputModes = (modality: string | undefined): InputMode[] => {
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
};

const normalizeConfiguredBaseUrl = (
	protocol: ProviderProtocol,
	baseUrl: string | undefined | null,
): string | null => {
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

const fetchProviderModels = async (
	config: ProviderFetchConfig,
): Promise<FetchedProviderModel[]> => {
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
			data?: {
				id: string;
				name?: string;
				display_name?: string;
				supported_parameters?: string[];
				architecture?: { modality?: string };
			}[];
		};

		return (body.data ?? []).map((model) => {
			const supportedParameters = normalizeSupportedParameters(model.supported_parameters);
			return {
				displayName: model.display_name ?? model.name ?? model.id,
				inputModes: parseOpenRouterInputModes(model.architecture?.modality),
				modelId: model.id,
				supportedParameters,
				supportsReasoning: supportedParameters.includes("reasoning"),
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
			inputModes: inferInputModesFromModelId(model.id),
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
			.map((model) => ({
				displayName: model.display_name ?? model.name ?? model.id,
				inputModes: inferInputModesFromModelId(model.id),
				modelId: model.id,
				supportedParameters: [],
				supportsReasoning: false,
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
		data?: {
			id: string;
			display_name?: string;
			name?: string;
		}[];
	};

	return (body.data ?? []).map((model) => ({
		displayName: model.display_name ?? model.name ?? model.id,
		inputModes: inferInputModesFromModelId(model.id),
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
		deduped.set(model.modelId, {
			...model,
			inputModes: normalizeInputModes(model.inputModes),
			supportedParameters,
			supportsReasoning: model.supportsReasoning || supportedParameters.includes("reasoning"),
		});
	}

	const existingModels = await db.query.aiModel.findMany({
		where: eq(aiModel.providerId, providerId),
	});

	const existingByModelId = new Map(existingModels.map((model) => [model.modelId, model] as const));

	let inserted = 0;
	let updated = 0;

	for (const model of deduped.values()) {
		const existing = existingByModelId.get(model.modelId);
		if (!existing) {
			await db.insert(aiModel).values({
				displayName: model.displayName,
				id: crypto.randomUUID(),
				inputModes: model.inputModes,
				modelId: model.modelId,
				providerId,
				supportedParameters: model.supportedParameters,
				supportsReasoning: model.supportsReasoning,
			});
			inserted += 1;
			continue;
		}

		const existingSupportedParameters = normalizeSupportedParameters(
			existing.supportedParameters,
		);
		const existingSupportsReasoning =
			existing.supportsReasoning || existingSupportedParameters.includes("reasoning");
		const sameDisplayName = existing.displayName === model.displayName;
		const sameSupportedParameters =
			JSON.stringify(existingSupportedParameters) ===
			JSON.stringify([...model.supportedParameters].toSorted());
		const sameSupportsReasoning = existingSupportsReasoning === model.supportsReasoning;
		const sameInputModes =
			JSON.stringify([...existing.inputModes].toSorted()) ===
			JSON.stringify([...model.inputModes].toSorted());

		if (sameDisplayName && sameSupportedParameters && sameSupportsReasoning && sameInputModes) {
			continue;
		}

		await db
			.update(aiModel)
			.set({
				displayName: model.displayName,
				inputModes: model.inputModes,
				supportedParameters: model.supportedParameters,
				supportsReasoning: model.supportsReasoning,
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
	const providers = await context.db.query.aiProvider.findMany({
		orderBy: (provider, { asc }) => asc(provider.name),
		with: { models: true },
	});

	return providers.map((provider) => ({
		...provider,
		apiKey: undefined,
		hasApiKey: !!provider.apiKey,
		models: provider.models.map((model) => {
			const supportedParameters = normalizeSupportedParameters(model.supportedParameters);
			return {
				...model,
				inputModes: resolveInputModes(model.inputModes, model.modelId),
				supportedParameters,
				supportsReasoning:
					model.supportsReasoning || supportedParameters.includes("reasoning"),
			};
		}),
	}));
});

const previewProviderInput = z.object({
	apiKey: z.string().optional(),
	baseUrl: createBaseUrlSchema,
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

		const models = await fetchProviderModels({
			apiKey: parsed.apiKey,
			baseUrl,
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
				protocol: parsed.protocol,
			})
			.returning();

		if (!provider) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: "Provider could not be created",
			});
		}

		const syncResult = await syncFetchedModelsForProvider(context.db, provider.id, models);

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
	protocol: z.enum(PROVIDER_PROTOCOLS).optional(),
});

const updateProviderHandler = admin
	.input(type<z.infer<typeof updateProviderInput>>())
	.handler(async ({ input, context }) => {
		const parsed = updateProviderInput.parse(input);
		const existing = await getProviderById(context.db, parsed.id);

		const nextProtocol = parsed.protocol ?? (existing.protocol as ProviderProtocol);
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
			nextApiKeyPlain = existing.apiKey ? await decrypt(existing.apiKey) : undefined;
		}

		const needsValidation =
			parsed.protocol !== undefined || parsed.baseUrl !== undefined || parsed.apiKey !== undefined;

		let syncResult: { inserted: number; updated: number; removed: number } | undefined;
		if (needsValidation) {
			const fetchedModels = await fetchProviderModels({
				apiKey: nextApiKeyPlain,
				baseUrl: nextBaseUrl,
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
				protocol: nextProtocol,
			})
			.where(eq(aiProvider.id, parsed.id))
			.returning();

		if (!provider) {
			throw new ORPCError("NOT_FOUND", { message: "Provider not found" });
		}

		return {
			...provider,
			apiKey: undefined,
			hasApiKey: !!provider.apiKey,
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
			apiKey,
			baseUrl: provider.baseUrl,
			protocol: provider.protocol as ProviderProtocol,
		});
		const syncResult = await syncFetchedModelsForProvider(context.db, provider.id, models);

		return {
			models,
			syncResult,
		};
	});

// ============ Model handlers ============

const createModelInput = z.object({
	displayName: z.string().min(1),
	inputModes: z.array(z.enum(["text", "audio", "file", "image"])).default(["text"]),
	modelId: z.string().min(1),
	providerId: z.string(),
	supportedParameters: z.array(z.string()).default([]),
	supportsReasoning: z.boolean().default(false),
});

const createModelHandler = admin
	.input(type<z.infer<typeof createModelInput>>())
	.handler(async ({ input, context }) => {
		const parsed = createModelInput.parse(input);
		const supportedParameters = normalizeSupportedParameters(parsed.supportedParameters);
		const [model] = await context.db
			.insert(aiModel)
			.values({
				displayName: parsed.displayName,
				id: crypto.randomUUID(),
				inputModes: normalizeInputModes(parsed.inputModes),
				modelId: parsed.modelId,
				providerId: parsed.providerId,
				supportedParameters,
				supportsReasoning:
					parsed.supportsReasoning || supportedParameters.includes("reasoning"),
			})
			.returning();

		return model;
	});

const updateModelInput = z.object({
	displayName: z.string().min(1).optional(),
	id: z.string(),
	inputModes: z.array(z.enum(["text", "audio", "file", "image"])).optional(),
	modelId: z.string().min(1).optional(),
	supportedParameters: z.array(z.string()).optional(),
	supportsReasoning: z.boolean().optional(),
});

const updateModelHandler = admin
	.input(type<z.infer<typeof updateModelInput>>())
	.handler(async ({ input, context }) => {
		const parsed = updateModelInput.parse(input);
		const supportedParameters = parsed.supportedParameters
			? normalizeSupportedParameters(parsed.supportedParameters)
			: undefined;
		const [model] = await context.db
			.update(aiModel)
			.set({
				displayName: parsed.displayName,
				inputModes: parsed.inputModes ? normalizeInputModes(parsed.inputModes) : undefined,
				modelId: parsed.modelId,
				supportedParameters,
				supportsReasoning:
					parsed.supportsReasoning ??
					(supportedParameters ? supportedParameters.includes("reasoning") : undefined),
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
		const [model] = await context.db.delete(aiModel).where(eq(aiModel.id, input.id)).returning();

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
		defaultEvaluationModel: defaults?.defaultEvaluationModel ?? null,
		defaultFileImageModelId: defaults?.defaultFileImageModelId ?? null,
		defaultSpeechToTextModelId: defaults?.defaultSpeechToTextModelId ?? null,
		defaultTextModelId: defaults?.defaultTextModelId ?? null,
	};
});

const setDefaultInput = z.object({
	defaultType: z.enum(["text", "file-image", "speech-to-text", "evaluation"]),
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
			defaultEvaluationModel: current?.defaultEvaluationModel ?? null,
			defaultFileImageModelId: current?.defaultFileImageModelId ?? null,
			defaultSpeechToTextModelId: current?.defaultSpeechToTextModelId ?? null,
			defaultTextModelId: current?.defaultTextModelId ?? null,
			id: "global",
			updatedAt: new Date(),
		};

		switch (parsed.defaultType) {
			case "text": {
				next.defaultTextModelId = parsed.modelId;
				break;
			}
			case "evaluation": {
				next.defaultEvaluationModel = parsed.modelId;
				break;
			}
			case "file-image": {
				next.defaultFileImageModelId = parsed.modelId;
				break;
			}
			case "speech-to-text": {
				next.defaultSpeechToTextModelId = parsed.modelId;
				break;
			}
			default: {
				throw new ORPCError("BAD_REQUEST", {
					message: "Ungültiger Standardtyp",
				});
			}
		}

		await (current
			? context.db
					.update(aiDefaults)
					.set({
						defaultEvaluationModel: next.defaultEvaluationModel,
						defaultFileImageModelId: next.defaultFileImageModelId,
						defaultSpeechToTextModelId: next.defaultSpeechToTextModelId,
						defaultTextModelId: next.defaultTextModelId,
						updatedAt: next.updatedAt,
					})
					.where(eq(aiDefaults.id, "global"))
			: context.db.insert(aiDefaults).values(next));

		return {
			defaultEvaluationModel: next.defaultEvaluationModel,
			defaultFileImageModelId: next.defaultFileImageModelId,
			defaultSpeechToTextModelId: next.defaultSpeechToTextModelId,
			defaultTextModelId: next.defaultTextModelId,
		};
	});

export const providersHandler = {
	connections: {
		create: createProviderHandler,
		delete: deleteProviderHandler,
		list: listProvidersHandler,
		previewModels: previewProviderHandler,
		refreshModels: refreshProviderModelsHandler,
		update: updateProviderHandler,
	},
	defaults: {
		get: getDefaultsHandler,
		set: setDefaultHandler,
	},
	models: {
		create: createModelHandler,
		delete: deleteModelHandler,
		update: updateModelHandler,
	},
};
