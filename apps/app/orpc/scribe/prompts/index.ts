// High-level prompt composition and registry access for scribe flows.
export {
	composeDocumentTypePrompt,
	composePromptHarnessPrompt,
	createPromptVariables,
} from "./compose";
export {
	documentTypeConfigs,
	PROMPT_HARNESS_IDS,
	type PromptHarnessId,
} from "./registry";
