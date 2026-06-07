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
export interface FillInputsContextFile {
	data: string;
	mimeType: string;
	name: string;
	size: number;
}

/**
 * Reusable clinical text context for input autofill
 */
export interface FillInputsTextContext {
	anamnese?: string;
	befunde?: string;
	diagnoseblock?: string;
	notes?: string;
}

/**
 * Generic field definition for input filling.
 * Uses labels as stable keys for downstream inputs
 */
export interface InputField {
	label: string;
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
	textContext?: FillInputsTextContext;
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
