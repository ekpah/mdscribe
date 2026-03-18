import type { InputTagType } from "@repo/markdoc-md/parse/parse-markdoc-to-inputs";

/**
 * Model configuration for streaming responses
 */
export interface ModelConfig {
	maxTokens?: number;
	temperature?: number;
	thinking?: boolean;
	thinkingBudget?: number;
}

/**
 * Audio file data for Gemini models
 */
export interface AudioFile {
	data: string;
	mimeType: string;
}

/**
 * Generic input field for voice fill
 * Uses labels as stable keys for downstream inputs
 */
export interface InputField {
	label: string;
	description?: string;
}

/**
 * Input tags for voice fill
 */
type VoiceFillInputTag = InputTagType;

/**
 * Voice fill input payload
 */
export interface VoiceFillInputPayload {
	inputTags?: VoiceFillInputTag[];
	inputFields?: InputField[];
	audioFiles: AudioFile[];
}

/**
 * Document type configurations
 */
export type DocumentType =
	| "discharge"
	| "anamnese"
	| "diagnosis"
	| "procedures"
	| "befunde"
	| "outpatient"
	| "icu-transfer";

/**
 * Prompt message for LLM
 */
export interface PromptMessage {
	role: "system" | "user" | "assistant";
	content: string;
}

export interface PromptVariables {
	relevantTemplate: string;
	todaysDate: string;
	contextXml: string;
}

/**
 * Configuration for each document type
 */
export interface DocumentTypeConfig {
	promptName: string;
	promptLabel?: string;
	systemPrompt: string;
}
