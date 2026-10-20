"use client";

export { DynamicMarkdocRenderer } from "./render/components/dynamic-markdoc-renderer";
export type { DynamicMarkdocRendererProps } from "./render/components/dynamic-markdoc-renderer";
export {
	MarkdocInteractionProvider,
	useMarkdocInteraction,
} from "./render/context/markdoc-interaction-context";
export type { MarkdocInteractionContextType } from "./render/context/markdoc-interaction-context";
export { useVariables, VariableProvider } from "./render/context/variable-context";
export type { VariableMap, VariableValue } from "./render/context/variable-context";
export {
	useVariableContract,
	VariableContractProvider,
} from "./render/context/variable-contract-context";
export { useResolvedVariable } from "./render/hooks/use-resolved-variable";
export type { ResolvedVariable } from "./render/hooks/use-resolved-variable";
export { useCitationModifier } from "./render/hooks/use-citation-modifier";
export { components } from "./markdoc-config/tags/helpers/components";
export { useCalcTag } from "./markdoc-config/tags/calc";
export type { CalcProps, CalcTagState } from "./markdoc-config/tags/calc";
export type { CaseProps } from "./markdoc-config/tags/case";
export type { CiteProps } from "./markdoc-config/tags/cite";
export type { DetailsProps } from "./markdoc-config/tags/details";
export { useInfoTag } from "./markdoc-config/tags/info";
export type { InfoProps, InfoTagState } from "./markdoc-config/tags/info";
export { useBranchTag } from "./markdoc-config/tags/switch";
export type { BranchTagState, SwitchProps } from "./markdoc-config/tags/switch";
export type { MarkdocComponentMap } from "./markdoc-config/tags/helpers/components";
export { default as renderMarkdocAsReact } from "./render/utils/render-markdoc-as-react";
export type { RenderMarkdocReactOptions } from "./render/utils/render-markdoc-as-react";
