import type { z } from "zod";

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
 * Base input for scribe endpoints
 */
export interface ScribeInput {
	prompt: string;
	model?: SupportedModel;
	audioFiles?: AudioFile[];
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
 * Configuration for each document type
 */
export interface DocumentTypeConfig {
	promptName: string;
	promptLabel?: string;
	processInput: (prompt: string) => Record<string, unknown>;
	modelConfig: ModelConfig;
}
