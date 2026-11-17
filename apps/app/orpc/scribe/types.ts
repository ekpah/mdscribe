import type { CitationRequest } from "markdoc-md/citations";

import type { ContextDocument, OcrResult } from "@/lib/ocr-types";
import type { TextInputId } from "@/orpc/scribe/prompts/template";

/**
 * Model configuration for streaming responses
 */
export type ReasoningEffort = "none" | "minimal" | "low" | "medium" | "high" | "xhigh";

export interface ModelConfig {
	maxTokens?: number;
	temperature?: number;
	thinking?: boolean;
	reasoningEffort?: ReasoningEffort;
}

/**
 * Audio file data for native multimodal and transcription-capable models.
 *
 * `data`/`mimeType` always describe the original browser recording. Optional
 * fallbacks are truthful transcodes that providers can choose when their chat
 * adapter does not accept the original format.
 */
export interface AudioFile {
	data: string;
	mimeType: string;
	wavFallback?: {
		data: string;
		mimeType: "audio/wav";
	};
}

/**
 * Generic file data for input autofill context.
 */
export type FillInputsContextFile = ContextDocument;

/**
 * Reusable clinical text context for input autofill
 */
type FillInputsTextContext = Partial<Record<TextInputId, string>>;

/**
 * Generic field definition for input filling.
 * Uses labels as stable keys for downstream inputs
 */
export interface InputField {
	label: string;
	calculation?: {
		components: string[];
		formula: string;
	};
	description?: string;
	options?: string[];
	unit?: string;
	type?: "string" | "number" | "date" | "switch" | "boolean";
}

/**
 * Payload for the general input-fill handler.
 */
export interface FillInputsInputPayload {
	inputFields: InputField[];
	audioFiles?: AudioFile[];
	contextFiles?: FillInputsContextFile[];
	templateExamples?: string[];
	templateInformation?: string;
	textContext?: FillInputsTextContext;
}

interface FillInputSuggestion {
	citations?: CitationRequest[];
	value: boolean | number | string;
}

export interface FillInputsResult {
	citationError?: boolean;
	ocrResults: OcrResult[];
	suggestions: Record<string, FillInputSuggestion>;
}

/**
 * Prompt message for LLM
 */
export interface PromptMessage {
	role: "system" | "user" | "assistant";
	content: string;
}
