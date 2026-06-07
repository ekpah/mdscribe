// High-level prompt composition and registry access for scribe flows.
export {
	composeDocumentTypePrompt,
	composePromptHarnessPrompt,
	createPromptVariables,
} from "./compose";
export {
	documentTypeConfigs,
	getDocumentTypeByPromptName,
	getPromptHarnessLabel,
	getPromptHarnessOption,
	getPromptHarnessReferences,
	resolvePromptHarnessId,
	PROMPT_HARNESS_IDS,
	PROMPT_HARNESS_OPTIONS,
	type PromptHarnessOption,
	type PromptHarnessId,
} from "./registry";
