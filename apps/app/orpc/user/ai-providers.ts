import { ORPCError, type } from "@orpc/server";
import { aiDefaults, aiModel, aiProvider, and, eq, inArray, userAiProvider } from "@repo/database";
import type { Database } from "@repo/database";
import { z } from "zod";

import { encrypt } from "@/lib/encryption";
import { USER_MESSAGES } from "@/lib/user-messages";
import { authed } from "@/orpc";
import { fetchProviderModels } from "@/orpc/admin/providers";
import type { ProviderProtocol } from "@/orpc/admin/providers";

const PROVIDER_PROTOCOLS = new Set<ProviderProtocol>([
	"anthropic",
	"openai",
	"openai-compatible",
	"openrouter",
	"tinfoil",
]);

const USER_MODEL_ROLES = ["text", "agent", "audio", "documents"] as const;
type UserModelRole = (typeof USER_MODEL_ROLES)[number];

interface ModelRoleAssignment {
	modelRecordId: string;
	role: UserModelRole;
}

const getUserModelRoleAssignments = (
	defaults: typeof aiDefaults.$inferSelect | undefined,
): ModelRoleAssignment[] => {
	if (!defaults) {
		return [];
	}

	const assignments: ModelRoleAssignment[] = [];
	const addAssignment = (modelRecordId: string | null, role: UserModelRole) => {
		if (modelRecordId) {
			assignments.push({ modelRecordId, role });
		}
	};

	addAssignment(defaults.defaultTextModelId, "text");
	addAssignment(
		defaults.defaultStandardSupportsAgent
			? defaults.defaultTextModelId
			: defaults.defaultAgentModelId,
		"agent",
	);

	const agentModelRecordId = defaults.defaultStandardSupportsAgent
		? defaults.defaultTextModelId
		: defaults.defaultAgentModelId;
	addAssignment(
		defaults.defaultStandardSupportsAudio
			? defaults.defaultTextModelId
			: defaults.defaultSpeechToTextModelId,
		"audio",
	);
	addAssignment(
		defaults.defaultStandardSupportsDocuments
			? defaults.defaultTextModelId
			: defaults.defaultFileImageModelId,
		"documents",
	);

	const doesAgentSupportAudio = defaults.defaultStandardSupportsAgent
		? defaults.defaultStandardSupportsAudio
		: defaults.defaultAgentSupportsAudio;
	const doesAgentSupportDocuments = defaults.defaultStandardSupportsAgent
		? defaults.defaultStandardSupportsDocuments
		: defaults.defaultAgentSupportsDocuments;
	addAssignment(
		doesAgentSupportAudio ? agentModelRecordId : defaults.defaultSpeechToTextModelId,
		"audio",
	);
	addAssignment(
		doesAgentSupportDocuments ? agentModelRecordId : defaults.defaultFileImageModelId,
		"documents",
	);

	return assignments;
};

const getAssignedModelsByProvider = async (
	db: Database,
	defaults: typeof aiDefaults.$inferSelect | undefined,
) => {
	const assignments = getUserModelRoleAssignments(defaults);
	const modelRecordIds = [...new Set(assignments.map((assignment) => assignment.modelRecordId))];
	if (modelRecordIds.length === 0) {
		return new Map<string, { displayName: string; modelId: string; roles: UserModelRole[] }[]>();
	}

	const models = await db.query.aiModel.findMany({
		where: inArray(aiModel.id, modelRecordIds),
	});
	const modelsById = new Map(models.map((model) => [model.id, model]));
	const assignedByProvider = new Map<
		string,
		Map<string, { displayName: string; modelId: string; roles: UserModelRole[] }>
	>();

	for (const assignment of assignments) {
		const model = modelsById.get(assignment.modelRecordId);
		if (!model) {
			continue;
		}
		const providerModels = assignedByProvider.get(model.providerId) ?? new Map();
		const existing = providerModels.get(model.id);
		if (existing) {
			if (!existing.roles.includes(assignment.role)) {
				existing.roles.push(assignment.role);
			}
		} else {
			providerModels.set(model.id, {
				displayName: model.displayName,
				modelId: model.modelId,
				roles: [assignment.role],
			});
		}
		assignedByProvider.set(model.providerId, providerModels);
	}

	return new Map(
		[...assignedByProvider].map(([providerId, modelsByRecordId]) => [
			providerId,
			[...modelsByRecordId.values()],
		]),
	);
};

const parseProviderProtocol = (protocol: string): ProviderProtocol => {
	if (PROVIDER_PROTOCOLS.has(protocol as ProviderProtocol)) {
		return protocol as ProviderProtocol;
	}
	throw new ORPCError("BAD_REQUEST", {
		message: USER_MESSAGES.byok.connectionUnavailable,
	});
};

const mapValidationError = (error: unknown): never => {
	if (error instanceof ORPCError) {
		if (
			error.message === USER_MESSAGES.byok.keyRejected ||
			error.message === USER_MESSAGES.byok.providerRateLimited ||
			error.message === USER_MESSAGES.byok.providerUnavailable
		) {
			throw error;
		}
		const message = error.message.toLowerCase();
		if (message.includes("429")) {
			throw new ORPCError("TOO_MANY_REQUESTS", {
				message: USER_MESSAGES.byok.providerRateLimited,
			});
		}
		if (message.includes("401") || message.includes("403")) {
			throw new ORPCError("BAD_REQUEST", {
				message: USER_MESSAGES.byok.keyRejected,
			});
		}
	}
	throw new ORPCError("BAD_REQUEST", {
		message: USER_MESSAGES.byok.providerUnavailable,
	});
};

const validateOpenRouterKey = async (apiKey: string): Promise<void> => {
	const response = await fetch("https://openrouter.ai/api/v1/key", {
		headers: { Authorization: `Bearer ${apiKey}` },
		signal: AbortSignal.timeout(10_000),
	});
	if (response.status === 401 || response.status === 403) {
		throw new ORPCError("BAD_REQUEST", {
			message: USER_MESSAGES.byok.keyRejected,
		});
	}
	if (response.status === 429) {
		throw new ORPCError("TOO_MANY_REQUESTS", {
			message: USER_MESSAGES.byok.providerRateLimited,
		});
	}
	if (!response.ok) {
		throw new ORPCError("BAD_REQUEST", {
			message: USER_MESSAGES.byok.providerUnavailable,
		});
	}
};

const validateCandidateKey = async (input: {
	apiKey: string;
	baseUrl: string | null;
	protocol: ProviderProtocol;
}): Promise<void> => {
	try {
		if (input.protocol === "openrouter") {
			await validateOpenRouterKey(input.apiKey);
			return;
		}
		await fetchProviderModels({
			apiKey: input.apiKey,
			baseUrl: input.baseUrl,
			protocol: input.protocol,
		});
	} catch (error) {
		mapValidationError(error);
	}
};

const getExposedProvider = async (db: Database, providerId: string) => {
	const provider = await db.query.aiProvider.findFirst({
		where: and(eq(aiProvider.id, providerId), eq(aiProvider.byokEnabled, true)),
	});
	if (!provider) {
		throw new ORPCError("BAD_REQUEST", {
			message: USER_MESSAGES.byok.connectionUnavailable,
		});
	}
	return provider;
};

const statusHandler = authed.handler(async ({ context }) => {
	const [availableProviders, credentials, defaults] = await Promise.all([
		context.db.query.aiProvider.findMany({
			orderBy: (provider, { asc }) => asc(provider.name),
			where: eq(aiProvider.byokEnabled, true),
		}),
		context.db.query.userAiProvider.findMany({
			where: eq(userAiProvider.userId, context.session.user.id),
			with: {
				provider: {
					columns: {
						id: true,
						name: true,
						protocol: true,
					},
				},
			},
		}),
		context.db.query.aiDefaults.findFirst({
			where: eq(aiDefaults.id, "global"),
		}),
	]);
	const assignedModelsByProvider = await getAssignedModelsByProvider(context.db, defaults);
	const credentialsByProvider = new Map(
		credentials.map((credential) => [credential.providerId, credential]),
	);
	const availableIds = new Set(availableProviders.map((provider) => provider.id));
	const connections = availableProviders.map((provider) => {
		const credential = credentialsByProvider.get(provider.id);
		return {
			available: true,
			connectionId: provider.id,
			connectionName: provider.name,
			credential: credential
				? {
						enabled: credential.enabled,
						hasApiKey: true as const,
						isVerified: Boolean(credential.validatedAt),
						name: credential.name,
						verifiedAt: credential.validatedAt,
					}
				: null,
			models: assignedModelsByProvider.get(provider.id) ?? [],
			protocol: provider.protocol,
		};
	});

	for (const credential of credentials) {
		if (availableIds.has(credential.providerId)) {
			continue;
		}
		connections.push({
			available: false,
			connectionId: credential.providerId,
			connectionName: credential.provider.name,
			credential: {
				enabled: credential.enabled,
				hasApiKey: true as const,
				isVerified: Boolean(credential.validatedAt),
				name: credential.name,
				verifiedAt: credential.validatedAt,
			},
			models: assignedModelsByProvider.get(credential.providerId) ?? [],
			protocol: credential.provider.protocol,
		});
	}

	return { connections };
});

const saveInput = z.object({
	apiKey: z.string().trim().min(1).max(4096),
	name: z.string().trim().min(1).max(60).optional(),
	providerId: z.string().min(1),
});

const saveHandler = authed
	.input(type<z.infer<typeof saveInput>>())
	.handler(async ({ input, context }) => {
		const parsed = saveInput.parse(input);
		const provider = await getExposedProvider(context.db, parsed.providerId);
		const protocol = parseProviderProtocol(provider.protocol);
		await validateCandidateKey({
			apiKey: parsed.apiKey,
			baseUrl: provider.baseUrl,
			protocol,
		});
		const encryptedApiKey = await encrypt(parsed.apiKey);
		const now = new Date();
		const [credential] = await context.db
			.insert(userAiProvider)
			.values({
				apiKey: encryptedApiKey,
				enabled: true,
				id: crypto.randomUUID(),
				name: parsed.name ?? provider.name,
				providerId: provider.id,
				updatedAt: now,
				userId: context.session.user.id,
				validatedAt: now,
			})
			.onConflictDoUpdate({
				set: {
					apiKey: encryptedApiKey,
					enabled: true,
					name: parsed.name ?? provider.name,
					updatedAt: now,
					validatedAt: now,
				},
				target: [userAiProvider.userId, userAiProvider.providerId],
			})
			.returning({
				enabled: userAiProvider.enabled,
				name: userAiProvider.name,
				providerId: userAiProvider.providerId,
				validatedAt: userAiProvider.validatedAt,
			});
		return credential;
	});

const setEnabledInput = z.object({
	enabled: z.boolean(),
	providerId: z.string().min(1),
});

const setEnabledHandler = authed
	.input(type<z.infer<typeof setEnabledInput>>())
	.handler(async ({ input, context }) => {
		const parsed = setEnabledInput.parse(input);
		if (parsed.enabled) {
			await getExposedProvider(context.db, parsed.providerId);
		}
		const [credential] = await context.db
			.update(userAiProvider)
			.set({ enabled: parsed.enabled })
			.where(
				and(
					eq(userAiProvider.providerId, parsed.providerId),
					eq(userAiProvider.userId, context.session.user.id),
				),
			)
			.returning({
				enabled: userAiProvider.enabled,
				providerId: userAiProvider.providerId,
			});
		if (!credential) {
			throw new ORPCError("NOT_FOUND", {
				message: USER_MESSAGES.byok.credentialMissing,
			});
		}
		return credential;
	});

const renameInput = z.object({
	name: z.string().trim().min(1).max(60),
	providerId: z.string().min(1),
});

const renameHandler = authed
	.input(type<z.infer<typeof renameInput>>())
	.handler(async ({ input, context }) => {
		const parsed = renameInput.parse(input);
		await getExposedProvider(context.db, parsed.providerId);
		const [credential] = await context.db
			.update(userAiProvider)
			.set({ name: parsed.name })
			.where(
				and(
					eq(userAiProvider.providerId, parsed.providerId),
					eq(userAiProvider.userId, context.session.user.id),
				),
			)
			.returning({
				name: userAiProvider.name,
				providerId: userAiProvider.providerId,
			});
		if (!credential) {
			throw new ORPCError("NOT_FOUND", {
				message: USER_MESSAGES.byok.credentialMissing,
			});
		}
		return credential;
	});

const deleteHandler = authed
	.input(type<{ providerId: string }>())
	.handler(async ({ input, context }) => {
		const [credential] = await context.db
			.delete(userAiProvider)
			.where(
				and(
					eq(userAiProvider.providerId, input.providerId),
					eq(userAiProvider.userId, context.session.user.id),
				),
			)
			.returning({ id: userAiProvider.id });
		if (!credential) {
			throw new ORPCError("NOT_FOUND", {
				message: USER_MESSAGES.byok.credentialMissing,
			});
		}
		return { success: true as const };
	});

export const aiProvidersHandler = {
	delete: deleteHandler,
	rename: renameHandler,
	save: saveHandler,
	setEnabled: setEnabledHandler,
	status: statusHandler,
};
