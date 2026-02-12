import type { InputTagType } from "@repo/markdoc-md/parse/parseMarkdocToInputs";

/**
 * Supported AI models via OpenRouter
 */
export type SupportedModel =
	| "auto"
	| "glm-4p6"
	| "claude-opus-4.5"
	| "gemini-3-pro"
	| "gemini-3-flash";

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
 * File attachment data for model input
 */
export interface FileAttachment {
	data: string;
	mimeType: string;
	name: string;
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
export type VoiceFillInputTag = InputTagType;

/**
 * Voice fill input payload
 */
export interface VoiceFillInputPayload {
	inputTags?: VoiceFillInputTag[];
	inputFields?: InputField[];
	audioFiles: AudioFile[];
}

/**
 * Base input for scribe endpoints
 */
export interface ScribeInput {
	prompt: string;
	model?: SupportedModel;
	audioFiles?: AudioFile[];
	fileAttachments?: FileAttachment[];
}

/**
 * Document type configurations
 */
export type DocumentType =
	| "discharge"
	| "anamnese"
	| "diagnosis"
	| "physical-exam"
	| "procedures"
	| "admission-todos"
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

/**
 * Prompt builder function type - receives typed variables and returns messages
 */
export type PromptBuilder<T> = (variables: T) => PromptMessage[];

/**
 * Base variables available to all prompts
 */
interface BasePromptVariables {
	todaysDate: string;
}

/**
 * Variables for discharge document type
 */
export interface DischargeVariables extends BasePromptVariables {
	anamnese: string;
	diagnoseblock: string;
	notes: string;
	befunde: string;
}

/**
 * Variables for anamnese document type
 */
export interface AnamneseVariables extends BasePromptVariables {
	notes: string;
	befunde: string;
	vordiagnosen: string;
}

/**
 * Variables for diagnosis document type
 */
export interface DiagnosisVariables extends BasePromptVariables {
	anamnese: string;
	notes: string;
	diagnoseblock: string;
	befunde: string;
}

/**
 * Variables for physical-exam document type
 */
export interface PhysicalExamVariables extends BasePromptVariables {
	notes: string;
}

/**
 * Variables for procedures document type
 */
export interface ProceduresVariables extends BasePromptVariables {
	notes: string;
	relevantTemplate: string;
}

/**
 * Variables for admission-todos document type
 */
export interface AdmissionTodosVariables extends BasePromptVariables {
	notes: string;
	anamnese: string;
	vordiagnosen: string;
	befunde: string;
}

/**
 * Variables for befunde document type
 */
export interface BefundeVariables extends BasePromptVariables {
	notes: string;
	anamnese: string;
	vordiagnosen: string;
}

/**
 * Variables for outpatient document type
 */
export interface OutpatientVariables extends BasePromptVariables {
	anamnese: string;
	diagnoseblock: string;
	notes: string;
	befunde: string;
}

/**
 * Variables for icu-transfer document type
 */
export interface IcuTransferVariables extends BasePromptVariables {
	anamnese: string;
	notes: string;
	diagnoseblock: string;
	befunde: string;
}

/**
 * Union type of all prompt variable types
 */
export type PromptVariables =
	| DischargeVariables
	| AnamneseVariables
	| DiagnosisVariables
	| PhysicalExamVariables
	| ProceduresVariables
	| AdmissionTodosVariables
	| BefundeVariables
	| OutpatientVariables
	| IcuTransferVariables;

/**
 * Configuration for each document type
 * Note: The prompt function uses a flexible type to allow typed variable
 * interfaces in config.ts while maintaining compatibility with the union type.
 */
export interface DocumentTypeConfig {
	promptName: string;
	promptLabel?: string;
	// biome-ignore lint/suspicious/noExplicitAny: Prompt functions receive typed variables at runtime
	prompt: (variables: any) => PromptMessage[];
	processInput: (prompt: string) => Record<string, unknown>;
	modelConfig: ModelConfig;
}
