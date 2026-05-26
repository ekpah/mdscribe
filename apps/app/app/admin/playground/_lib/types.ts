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
	inputModes?: string[];
	supportsReasoning?: boolean;
}

export type ReasoningEffort = "none" | "minimal" | "low" | "medium" | "high" | "xhigh";

export interface PlaygroundParameters {
	temperature: number;
	maxTokens: number;
	thinking: boolean;
	thinkingExplicit: boolean;
	reasoningEffort: ReasoningEffort;
	topP?: number;
	topK?: number;
	frequencyPenalty?: number;
	presencePenalty?: number;
}

export interface PlaygroundResult {
	text: string;
	reasoning?: string;
	evaluation?: {
		totalScore?: number;
		categories: {
			comment?: string;
			name: string;
			score: number;
		}[];
		isLoading: boolean;
		summary?: string;
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
