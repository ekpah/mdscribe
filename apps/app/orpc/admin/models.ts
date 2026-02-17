import {
	and,
	count,
	desc,
	gte,
	isNotNull,
	ne,
	usageEvent,
} from "@repo/database";
import { env } from "@repo/env";
import { z } from "zod";
import { authed } from "@/orpc";
import { requiredAdminMiddleware } from "../middlewares/admin";

interface OpenRouterModel {
	id: string;
	name: string;
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
	per_request_limits?: {
		prompt_tokens?: string;
		completion_tokens?: string;
	};
	supported_parameters?: string[];
}

interface OpenRouterModelsResponse {
	data: OpenRouterModel[];
}

interface ModelCapabilities {
	supportsText: boolean;
	supportsImage: boolean;
	supportsAudio: boolean;
	supportsVideo: boolean;
	outputsText: boolean;
	outputsImage: boolean;
	outputsAudio: boolean;
}

interface PlaygroundModel {
	id: string;
	name: string;
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
}

function parseModality(modality: string): ModelCapabilities {
	const [input, output] = modality.split("->");
	const inputs = input?.toLowerCase() || "";
	const outputs = output?.toLowerCase() || "";

	return {
		supportsText: inputs.includes("text"),
		supportsImage: inputs.includes("image"),
		supportsAudio: inputs.includes("audio"),
		supportsVideo: inputs.includes("video"),
		outputsText: outputs.includes("text"),
		outputsImage: outputs.includes("image"),
		outputsAudio: outputs.includes("audio"),
	};
}

// Cache for models list (1 hour TTL)
let modelsCache: { data: PlaygroundModel[]; timestamp: number } | null = null;
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

/**
 * List all available OpenRouter models
 */
const listModelsHandler = authed
	.use(requiredAdminMiddleware)
	.handler(async () => {
		// Check cache
		if (modelsCache && Date.now() - modelsCache.timestamp < CACHE_TTL) {
			return modelsCache.data;
		}

		const response = await fetch("https://openrouter.ai/api/v1/models", {
			headers: {
				Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
			},
		});

		if (!response.ok) {
			throw new Error(`OpenRouter API error: ${response.status}`);
		}

		const data: OpenRouterModelsResponse = await response.json();

		// Transform and sort models - prioritize popular providers
		const priorityProviders = [
			"anthropic",
			"openai",
			"google",
			"meta-llama",
			"mistralai",
			"cohere",
			"deepseek",
			"qwen",
		];

		const sortedModels = data.data.sort((a, b) => {
			const aProvider = a.id.split("/")[0];
			const bProvider = b.id.split("/")[0];
			const aIndex = priorityProviders.indexOf(aProvider);
			const bIndex = priorityProviders.indexOf(bProvider);

			if (aIndex !== -1 && bIndex !== -1) {
				return aIndex - bIndex;
			}
			if (aIndex !== -1) return -1;
			if (bIndex !== -1) return 1;
			return a.name.localeCompare(b.name);
		});

		// Add parsed modality info
		const modelsWithCapabilities: PlaygroundModel[] = sortedModels.map(
			(model) => ({
				id: model.id,
				name: model.name,
				description: model.description,
				context_length: model.context_length,
				architecture: model.architecture,
				pricing: model.pricing,
				top_provider: model.top_provider,
				capabilities: parseModality(
					model.architecture?.modality || "text->text",
				),
				supported_parameters: model.supported_parameters ?? [],
			}),
		);

		// Update cache
		modelsCache = { data: modelsWithCapabilities, timestamp: Date.now() };

		return modelsWithCapabilities;
	});

/**
 * Get the top N most used models from the past 30 days
 * Excludes "auto" and null models from the count
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

		// Get date 30 days ago
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
