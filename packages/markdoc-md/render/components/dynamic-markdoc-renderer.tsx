import { MarkdocInteractionProvider } from "@repo/markdoc-md/render/context/markdoc-interaction-context";
import { VariableProvider } from "@repo/markdoc-md/render/context/variable-context";
import renderMarkdocAsReact from "@repo/markdoc-md/render/utils/render-markdoc-as-react";
import { useMemo } from "react";

interface DynamicMarkdocRendererProps {
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
	activeTagName?: string | null;
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
	onTagSelect,
	// Default class matching Note.tsx
	className = "prose prose-slate grow",
}: DynamicMarkdocRendererProps) => {
	const renderedContent = useMemo(() => renderMarkdocAsReact(markdocContent), [markdocContent]);
	const normalizedVariables = (variables ?? {}) as Record<
		string,
		string | number | boolean | null | undefined
	>;

	return (
		<MarkdocInteractionProvider value={{ activeTagName, onTagSelect }}>
			<VariableProvider value={normalizedVariables}>
				<div className={className}>{renderedContent}</div>
			</VariableProvider>
		</MarkdocInteractionProvider>
	);
};
