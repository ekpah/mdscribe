"use client";

import type { Config } from "@markdoc/markdoc";
import Markdoc from "@markdoc/markdoc";
import { useMemo } from "react";

import type { CitationRequest } from "../../citations/resolvers";
import type { MarkdocComponentMap } from "../../markdoc-config/tags/helpers/components";
import { buildVariableContracts } from "../../parse/validate-markdoc-tag-contracts";
import { MarkdocInteractionProvider } from "../context/markdoc-interaction-context";
import { VariableProvider } from "../context/variable-context";
import { VariableContractProvider } from "../context/variable-contract-context";
import { useCitationModifier } from "../hooks/use-citation-modifier";
import renderMarkdocAsReact from "../utils/render-markdoc-as-react";
import { sanitizeMarkdocForRendering } from "../utils/sanitize-markdoc-for-rendering";

export interface DynamicMarkdocRendererProps {
	/**
	 * The raw Markdoc content string.
	 */
	markdocContent: string;
	/**
	 * An object containing key-value pairs for dynamic variables
	 * used within the Markdoc content (e.g., via custom tags like Info).
	 */
	variables?: Record<string, unknown>;
	/**
	 * Optional CSS class name(s) to apply to the wrapping div.
	 * Defaults to 'prose prose-slate grow' if not provided.
	 */
	className?: string;
	/** Additional or replacement React components for custom render names. */
	components?: MarkdocComponentMap;
	/** A complete Markdoc config. */
	config?: Config;
	activeTagName?: string | null;
	/** Called with the cited source URI when a cite mark is clicked or keyboard-activated. */
	onCitationSelect?: (citation: CitationRequest) => void;
	onTagSelect?: (tagName: string) => void;
}

/**
 * Renders Markdoc content dynamically, allowing variable updates
 * without re-parsing the entire Markdoc string.
 *
 * It parses the Markdoc string once (memoized) and then renders the
 * resulting React node tree within a Context Provider.
 * Custom tags within the Markdoc content should use the `useVariables` hook
 * to access and react to changes in the provided `variables` object.
 */
export const DynamicMarkdocRenderer = ({
	markdocContent,
	variables,
	activeTagName,
	onCitationSelect,
	onTagSelect,
	// Default class matching Note.tsx
	className = "prose prose-slate grow",
	components,
	config,
}: DynamicMarkdocRendererProps) => {
	const areCitationsHighlighted = useCitationModifier();
	const renderedContent = useMemo(
		() => renderMarkdocAsReact(markdocContent, { components, config }),
		[components, config, markdocContent],
	);
	const variableContracts = useMemo(
		() =>
			buildVariableContracts(Markdoc.parse(sanitizeMarkdocForRendering(markdocContent))).contracts,
		[markdocContent],
	);
	const normalizedVariables = (variables ?? {}) as Record<
		string,
		string | number | boolean | null | undefined
	>;

	return (
		<MarkdocInteractionProvider
			value={{ activeTagName, areCitationsHighlighted, onCitationSelect, onTagSelect }}
		>
			<VariableContractProvider value={variableContracts}>
				<VariableProvider value={normalizedVariables}>
					<div className={className}>{renderedContent}</div>
				</VariableProvider>
			</VariableContractProvider>
		</MarkdocInteractionProvider>
	);
};
