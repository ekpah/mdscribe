// High-level context composition for scribe requests.
export {
	composeScribeContext,
	createContextSources,
	type ComposedScribeContext,
	type ComposeScribeContextInput,
	type TemplateContextInput,
} from "./compose";

// Low-level provider execution for callers that already have normalized sources.
export { buildScribeContext } from "./build";
export { derivePatientContext } from "./normalize";
export type {
	ContextBlock,
	ContextBuildInput,
	ContextSource,
	PatientContextData,
} from "./types";
