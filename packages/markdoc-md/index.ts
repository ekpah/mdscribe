export {
	analyzeMarkdocTemplate,
	default as parseMarkdocToInputs,
} from "./parse/parse-markdoc-to-inputs";
export type {
	BaseInputTag,
	CalcInputTagType,
	CaseInputTagType,
	InfoInputTagType,
	InputTagType,
	MarkdocTemplateAnalysis,
	ScoreInputTagType,
	SwitchInputTagType,
} from "./parse/parse-markdoc-to-inputs";
export {
	normalizeBooleanToString,
	toBooleanValue,
	toFormulaValue,
	toVoiceBooleanValue,
} from "./parse/boolean-coercion";
export { evaluateFormula, getFormulaVariables, isValidFormula } from "./parse/formula";
export {
	CASE_CONDITION_OPERATORS,
	hasCaseCondition,
	matchesCaseCondition,
	resolveMatchedCaseIndex,
	serializeCaseCondition,
	toCaseCondition,
	toNumericSwitchValue,
} from "./parse/case-conditions";
export type { CaseCondition, CaseConditionOperator } from "./parse/case-conditions";
export {
	buildVariableContracts,
	deriveSwitchDomain,
	validateMarkdocTagContracts,
} from "./parse/validate-markdoc-tag-contracts";
export type {
	CaseConditionIssue,
	MarkdocContractAttribute,
	MarkdocSettingConflict,
	MarkdocTagDiagnostic,
	VariableContract,
	VariableContractsResult,
	VariableDomain,
	VariableRoles,
} from "./parse/validate-markdoc-tag-contracts";
export { validateMarkdocTemplate } from "./parse/validate-markdoc-template";
export type { MarkdocTemplateDiagnostic } from "./parse/validate-markdoc-template";
export {
	findQuoteInInputText,
	MAX_CITATION_QUOTE_LENGTH,
	MAX_CITATION_TEXT_LENGTH,
	normalizeCitationSearchText,
	resolveCitation,
} from "./citations/resolvers";
export type {
	CitationDocumentLocation,
	CitationReference,
	CitationRequest,
	CitationResolution,
	CitationResolutionErrorCode,
	CitationResolverContext,
	CitationTextMatch,
	CitationTextSource,
} from "./citations/resolvers";
export {
	createMdscribeSource,
	MAX_CITATION_SOURCE_LENGTH,
	parseCitationSource,
	parseExternalCitationUrl,
} from "./render/utils/citation-source";
export type { CitationSourceReference } from "./render/utils/citation-source";
export { markdocConfig } from "./markdoc-config";
export { sanitizeMarkdocForRendering } from "./render/utils/sanitize-markdoc-for-rendering";
export { inspectMarkdocSources, resolveMarkdocSources } from "./sources/resolve-markdoc-sources";
export type {
	InspectedMarkdocSource,
	InspectedMarkdocSources,
	MarkdocSourceContexts,
	MarkdocSourceDiagnostic,
	MarkdocSourceDiagnosticCode,
	MarkdocSourceValue,
	ResolvedMarkdocSources,
} from "./sources/resolve-markdoc-sources";
