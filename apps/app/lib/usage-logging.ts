import type { NewUsageEvent } from "@repo/database";

/**
 * Type for inputData JSON field - flexible to accommodate different endpoint inputs
 */
export interface UsageInputData {
	// Common fields across endpoints
	anamnese?: string;
	notes?: string;
	befunde?: string;
	diagnoseblock?: string;
	epikrise?: string;
	// Template completion specific
	template?: string;
	body?: Record<string, unknown>;
	// Allow additional fields for future extensibility
	[key: string]: unknown;
}

/**
 * Type for metadata JSON field
 */
export interface UsageMetadata {
	credentialSource?: "operator" | "user_byok";
	promptName: string;
	promptLabel?: string;
	customFormId?: string;
	customFormSlug?: string;
	endpoint?: string;
	modelConfig?: {
		maxTokens?: number;
		reasoningEffort?: string;
		temperature?: number;
	};
	providerProtocol?: string;
	templateId?: string | null;
	// Allow additional fields for future extensibility
	[key: string]: unknown;
}

export const isByokUsageMetadata = (metadata: unknown): boolean => {
	if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
		return false;
	}
	const record = metadata as Record<string, unknown>;
	return record.credentialSource === "user_byok";
};

/**
 * OpenRouter usage data structure
 * Available via providerMetadata.openrouter.usage when usage: { include: true } is set
 */
interface OpenRouterUsage {
	promptTokens: number;
	promptTokensDetails?: { cachedTokens: number };
	completionTokens: number;
	completionTokensDetails?: { reasoningTokens: number };
	totalTokens: number;
	cost?: number;
	costDetails?: { upstreamInferenceCost: number };
}

/**
 * Extract OpenRouter usage data from AI SDK provider metadata
 */
export const extractOpenRouterUsage = (
	providerMetadata: Record<string, unknown> | undefined,
): OpenRouterUsage | null => {
	if (!providerMetadata) {return null;}

	const openrouterData = providerMetadata.openrouter as
		| { usage?: OpenRouterUsage }
		| undefined;
	return openrouterData?.usage ?? null;
};

/**
 * Standard AI SDK usage data (fallback when OpenRouter usage isn't available)
 */
export interface StandardUsage {
	inputTokens?: number;
	outputTokens?: number;
	totalTokens?: number;
}

/**
 * Duration metrics captured around the model request.
 */
export interface UsageTiming {
	timeToCompletionMs?: number;
	timeToFirstTokenMs?: number;
}

/**
 * Parameters for creating a usage event
 */
interface CreateUsageEventParams {
	id?: string;
	userId: string;
	name: string;
	model?: string;
	openRouterUsage?: OpenRouterUsage | null;
	// Fallback usage from AI SDK.
	standardUsage?: StandardUsage;
	inputData?: UsageInputData;
	metadata?: UsageMetadata;
	result?: string;
	// Can be string, array, or other.
	reasoning?: string | string[] | unknown;
	timing?: UsageTiming;
	traceId?: string;
}

/**
 * Normalize reasoning to a string or undefined
 * Handles arrays (from thinking mode), strings, and other types
 */
const normalizeReasoning = (
	reasoning: string | string[] | unknown,
): string | undefined => {
	if (reasoning === undefined || reasoning === null) {
		return undefined;
	}
	if (typeof reasoning === "string") {
		// Return undefined for empty strings.
		return reasoning || undefined;
	}
	if (Array.isArray(reasoning)) {
		if (reasoning.length === 0) {
			return undefined;
		}
		// Join array elements, filtering out non-strings
		const joined = reasoning
			.filter((item) => typeof item === "string")
			.join("\n");
		return joined || undefined;
	}
	// For other types, try to convert to string
	return String(reasoning) || undefined;
};

const normalizeDurationMs = (durationMs: number | undefined): number | undefined => {
	if (durationMs === undefined || !Number.isFinite(durationMs)) {
		return undefined;
	}
	return Math.max(0, Math.round(durationMs));
};

/**
 * Build a consistent usage event data object for database insertion
 */
export const buildUsageEventData = (
	params: CreateUsageEventParams,
): NewUsageEvent => {
	const {
		userId,
		name,
		model,
		openRouterUsage,
		standardUsage,
		inputData,
		id,
		metadata,
		result,
		reasoning,
		timing,
		traceId,
	} = params;

	// Use OpenRouter usage if available, otherwise fall back to standard usage
	const inputTokens =
		openRouterUsage?.promptTokens ?? standardUsage?.inputTokens;
	const outputTokens =
		openRouterUsage?.completionTokens ?? standardUsage?.outputTokens;
	const totalTokens =
		openRouterUsage?.totalTokens ?? standardUsage?.totalTokens;

	return {
		cachedTokens: openRouterUsage?.promptTokensDetails?.cachedTokens,
		cost: openRouterUsage?.cost?.toString(),
		id,
		inputData: inputData as Record<string, unknown>,
		inputTokens,
		metadata: metadata as Record<string, unknown>,
		model,
		name,
		outputTokens,
		reasoning: normalizeReasoning(reasoning),
		reasoningTokens: openRouterUsage?.completionTokensDetails?.reasoningTokens,
		result,
		timeToCompletionMs: normalizeDurationMs(timing?.timeToCompletionMs),
		timeToFirstTokenMs: normalizeDurationMs(timing?.timeToFirstTokenMs),
		totalTokens,
		traceId,
		userId,
	};
};
