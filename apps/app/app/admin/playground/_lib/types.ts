export interface ModelCapabilities {
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
	inputModes?: string[];
	supportsReasoning?: boolean;
}

export interface PlaygroundParameters {
	temperature: number;
	maxTokens: number;
	thinking: boolean;
	thinkingExplicit: boolean;
	thinkingBudget: number;
	topP?: number;
	topK?: number;
	frequencyPenalty?: number;
	presencePenalty?: number;
}

export interface PlaygroundMessage {
	role: "system" | "user" | "assistant";
	content: string;
}

export interface AudioFile {
	id: string;
	blob: Blob;
	duration: number;
	mimeType: string;
}

export interface ImageFile {
	id: string;
	blob: Blob;
	url: string;
	mimeType: string;
	filename: string;
}

export interface DocumentFile {
	id: string;
	blob: Blob;
	url: string;
	mimeType: string;
	filename: string;
}

export interface PlaygroundResult {
	text: string;
	reasoning?: string;
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
}

export interface PlaygroundPanelState {
	model: PlaygroundModel | null;
	parameters: PlaygroundParameters;
	messages: PlaygroundMessage[];
	systemPrompt: string;
	userPrompt: string;
	audioFiles: AudioFile[];
	imageFiles: ImageFile[];
	documentFiles: DocumentFile[];
	result: PlaygroundResult | null;
}

// Default parameters
export const DEFAULT_PARAMETERS: PlaygroundParameters = {
	frequencyPenalty: undefined,
	maxTokens: 4096,
	presencePenalty: undefined,
	temperature: 1,
	thinking: false,
	thinkingBudget: 8000,
	thinkingExplicit: false,
	topK: undefined,
	topP: undefined,
};

/**
 * Whether a model supports the reasoning/thinking parameter.
 */
export function supportsThinking(model: PlaygroundModel): boolean {
	return (
		model.supportsReasoning === true ||
		model.supported_parameters.includes("reasoning")
	);
}

// Format cost for display
export function formatCost(cost: number | undefined): string {
	if (cost === undefined || cost === null) {return "-";}
	return `$${cost.toFixed(6)}`;
}

// Format tokens for display
export function formatTokens(tokens: number | undefined): string {
	if (tokens === undefined || tokens === null) {return "-";}
	return tokens.toLocaleString("de-DE");
}

// Format latency for display
export function formatLatency(ms: number | undefined): string {
	if (ms === undefined || ms === null) {return "-";}
	if (ms < 1000) {return `${ms}ms`;}
	return `${(ms / 1000).toFixed(2)}s`;
}
