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

export interface PlaygroundParameters {
	temperature: number;
	maxTokens: number;
	thinking: boolean;
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
	temperature: 1,
	maxTokens: 4096,
	thinking: false,
	thinkingBudget: 8000,
	topP: undefined,
	topK: undefined,
	frequencyPenalty: undefined,
	presencePenalty: undefined,
};

/**
 * Models that always produce reasoning and cannot have it disabled.
 * Sending `reasoning: { enabled: false }` to these models causes an error.
 * OpenRouter doesn't expose a "requires_reasoning" flag, so we maintain
 * a small pattern list for known mandatory-reasoning models.
 */
export function requiresThinking(modelId: string): boolean {
	const id = modelId.toLowerCase();
	return (
		id.includes("deepseek-r1") ||
		id.includes("deepseek/r1") ||
		id.includes("qwq") ||
		id.includes("o1") ||
		id.includes("o3") ||
		id.includes("o4")
	);
}

/**
 * Whether a model supports the reasoning/thinking parameter.
 * Uses the `supported_parameters` array from the OpenRouter API.
 */
export function supportsThinking(model: PlaygroundModel): boolean {
	return model.supported_parameters.includes("reasoning");
}

// Format cost for display
export function formatCost(cost: number | undefined): string {
	if (cost === undefined || cost === null) return "-";
	return `$${cost.toFixed(6)}`;
}

// Format tokens for display
export function formatTokens(tokens: number | undefined): string {
	if (tokens === undefined || tokens === null) return "-";
	return tokens.toLocaleString("de-DE");
}

// Format latency for display
export function formatLatency(ms: number | undefined): string {
	if (ms === undefined || ms === null) return "-";
	if (ms < 1000) return `${ms}ms`;
	return `${(ms / 1000).toFixed(2)}s`;
}
