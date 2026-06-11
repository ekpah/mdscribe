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
	getPromptHarnessReferences,
	getPromptHarnessTargetField,
	resolvePromptHarnessId,
	PROMPT_HARNESS_IDS,
	PROMPT_HARNESS_OPTIONS,
	SELECTABLE_PROMPT_HARNESS_OPTIONS,
	type CanonicalContextField,
	type PromptHarnessId,
} from "./registry";
