import type { ReasoningEffort } from "@/app/admin/_lib/reasoning";

interface ModelCapabilities {
	supportsText: boolean;
	supportsImage: boolean;
	supportsAudio: boolean;
	supportsVideo: boolean;
	outputsText: boolean;
	outputsImage: boolean;
	outputsAudio: boolean;
}

export interface PlaygroundModel {
	id: string;
	modelId: string;
	name: string;
	providerId?: string;
	providerName?: string;
	providerProtocol?: string;
	// Backward compatibility while payload migrates.
	connectionId?: string;
	connectionProtocol?: string;
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
	supportedParameters?: string[];
	supportsReasoning?: boolean;
}

export type { ReasoningEffort };

export interface PlaygroundParameters {
	temperature: number;
	/** Undefined = Modell-Standard; nur gesetzt, wenn der Nutzer explizit ein Limit wählt. */
	maxTokens?: number;
	thinking: boolean;
	thinkingExplicit: boolean;
	reasoningEffort?: ReasoningEffort;
	topP?: number;
	topK?: number;
	frequencyPenalty?: number;
	presencePenalty?: number;
}

interface PlaygroundEvaluation {
	categories: {
		comment?: string;
		name: string;
		score: number;
	}[];
	evaluatedAt: string;
	instrument: "PDQI-9";
	maxScore: number;
	summary: string;
	totalScore: number;
}

export interface PlaygroundResult {
	text: string;
	reasoning?: string;
	evaluation?: PlaygroundEvaluation;
	isEvaluating?: boolean;
	comparison?: {
		isLoading: boolean;
		note?: string;
		preferredResponse?: "reference" | "result";
		referenceLabel: string;
	};
	metrics: {
		latencyMs: number;
		inputTokens?: number;
		outputTokens?: number;
		totalTokens?: number;
		reasoningTokens?: number;
		cost?: number;
	};
	isStreaming: boolean;
	error?: string;
	sourceLabel?: string;
	modelLabel?: string;
}
