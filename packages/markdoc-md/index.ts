export {
	analyzeMarkdocTemplate,
	default as parseMarkdocToInputs,
} from "./parse/parse-markdoc-to-inputs";
export type {
	InfoInputTagType,
	InputTagType,
	MarkdocTemplateAnalysis,
	SwitchInputTagType,
} from "./parse/parse-markdoc-to-inputs";
export { validateMarkdocTagContracts } from "./parse/validate-markdoc-tag-contracts";
export type {
	MarkdocContractAttribute,
	MarkdocSettingConflict,
	MarkdocTagDiagnostic,
} from "./parse/validate-markdoc-tag-contracts";
export { DynamicMarkdocRenderer } from "./render/components/dynamic-markdoc-renderer";
export { useVariables, VariableProvider } from "./render/context/variable-context";
export { inspectMarkdocSources, resolveMarkdocSources } from "./sources/resolve-markdoc-sources";
export type {
	InspectedMarkdocSource,
	InspectedMarkdocSources,
	MarkdocSourceContexts,
	MarkdocSourceDiagnostic,
	MarkdocSourceValue,
	ResolvedMarkdocSources,
} from "./sources/resolve-markdoc-sources";
