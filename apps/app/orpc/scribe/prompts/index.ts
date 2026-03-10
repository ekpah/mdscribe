// High-level prompt composition and registry access for scribe flows.
export {
	buildSelectedTemplateReference,
	composeDocumentTypePrompt,
	composePromptHarnessPrompt,
	createPromptVariables,
	injectCustomTemplateInstruction,
	resolveCustomModelConfig,
	todaysDateDE,
	type PromptCompositionInput,
} from "./compose";
export { findRelevantTemplateForProcedure } from "./relevant-template";
export {
	documentTypeConfigs,
	getDocumentTypeConfigByPromptName,
	getPromptHarnessById,
	PROMPT_HARNESS_IDS,
	type PromptHarnessId,
	type RegisteredPromptHarness,
} from "./registry";

// Low-level prompt harness primitives stay available for prompt authoring.
export { createPromptMessages } from "./shared";
