import { and, count, desc, gte, isNotNull, ne, usageEvent } from "@repo/database";
import { z } from "zod";

import { authed } from "@/orpc";
import { requiredAdminMiddleware } from "@/orpc/middlewares/admin";

interface ModelCapabilities {
	supportsText: boolean;
	supportsImage: boolean;
	supportsAudio: boolean;
	supportsVideo: boolean;
	outputsText: boolean;
	outputsImage: boolean;
	outputsAudio: boolean;
}

interface AdminModel {
	id: string;
	modelId: string;
	name: string;
	providerId: string;
	providerName: string;
	providerProtocol: string;
	// Backward compatibility while frontend payload migrates fully.
	connectionId: string;
	connectionProtocol: string;
	description?: string;
	context_length: number;
	architecture: {
		modality: string;
		tokenizer: string;
		instruct_type?: string;
	};
	pricing: {
		prompt: string;
		completion: string;
		image?: string;
		request?: string;
	};
	top_provider?: {
		context_length?: number;
		max_completion_tokens?: number;
		is_moderated?: boolean;
	};
	capabilities: ModelCapabilities;
	supported_parameters: string[];
	supportedParameters: string[];
	supportsReasoning: boolean;
}

const UNKNOWN_CAPABILITIES: ModelCapabilities = {
	outputsAudio: false,
	outputsImage: false,
	outputsText: true,
	supportsAudio: false,
	supportsImage: false,
	supportsText: true,
	supportsVideo: false,
};

const normalizeSupportedParameters = (parameters: string[] | undefined): string[] =>
	parameters ?? [];

const listModelsHandler = authed.use(requiredAdminMiddleware).handler(async ({ context }) => {
	const providers = await context.db.query.aiProvider.findMany({
		orderBy: (provider, { asc }) => asc(provider.name),
		with: { models: true },
	});

	const models: AdminModel[] = [];
	for (const provider of providers) {
		for (const model of provider.models) {
			const supportedParameters = normalizeSupportedParameters(model.supportedParameters);
			const supportsReasoning =
				model.supportsReasoning || supportedParameters.includes("reasoning");
			models.push({
				architecture: {
					modality: "unknown",
					tokenizer: "unknown",
				},
				capabilities: UNKNOWN_CAPABILITIES,
				connectionId: provider.id,
				connectionProtocol: provider.protocol,
				context_length: 0,
				id: model.id,
				modelId: model.modelId,
				name: model.displayName,
				pricing: { completion: "0", prompt: "0" },
				providerId: provider.id,
				providerName: provider.name,
				providerProtocol: provider.protocol,
				supportedParameters,
				supported_parameters: supportedParameters,
				supportsReasoning,
			});
		}
	}

	return models;
});

/**
 * Get the top N most used models from the past 30 days.
 * Excludes "auto" and null models from the count.
 */
const getTopModelsHandler = authed
	.use(requiredAdminMiddleware)
	.input(
		z
			.object({
				limit: z.number().min(1).max(20).optional(),
			})
			.optional(),
	)
	.handler(async ({ context, input }) => {
		const limit = input?.limit ?? 5;

		const thirtyDaysAgo = new Date();
		thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

		const topModels = await context.db
			.select({
				model: usageEvent.model,
				usageCount: count(),
			})
			.from(usageEvent)
			.where(
				and(
					isNotNull(usageEvent.model),
					ne(usageEvent.model, "auto"),
					gte(usageEvent.timestamp, thirtyDaysAgo),
				),
			)
			.groupBy(usageEvent.model)
			.orderBy(desc(count()))
			.limit(limit);

		return topModels.map((m) => m.model).filter(Boolean) as string[];
	});

export const modelsHandler = {
	list: listModelsHandler,
	topModels: getTopModelsHandler,
};
