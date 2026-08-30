export {
	analyzeMarkdocTemplate,
	default,
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
