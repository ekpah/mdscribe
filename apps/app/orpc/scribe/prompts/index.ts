// High-level prompt composition and registry access for scribe flows.
export {
	composeDocumentTypePrompt,
	composePromptHarnessPrompt,
	createPromptVariables,
	injectCustomTemplateInstruction,
	resolveCustomModelConfig,
	todaysDateDE,
	type PromptCompositionInput,
} from "./compose";
export {
	documentTypeConfigs,
	getDocumentTypeConfigByPromptName,
	getPromptHarnessById,
	PROMPT_HARNESS_IDS,
	type PromptHarnessId,
	type RegisteredPromptHarness,
} from "./registry";
