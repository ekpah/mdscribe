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
export { useCitationModifier } from "./render/hooks/use-citation-modifier";
export { components } from "./markdoc-config/tags/components";
export type { MarkdocComponentMap } from "./markdoc-config/tags/components";
export { default as renderMarkdocAsReact } from "./render/utils/render-markdoc-as-react";
export type { RenderMarkdocReactOptions } from "./render/utils/render-markdoc-as-react";
