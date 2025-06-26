import { useMemo } from 'react';
import { VariableProvider } from '../context/VariableContext';
import { parseMarkdoc, renderMarkdocNode } from '../renderNote';

interface DynamicMarkdocRendererProps {
  /**
   * The raw Markdoc content string.
   */
  markdocContent: string;
  /**
   * An object containing key-value pairs for dynamic variables
   * used within the Markdoc content (e.g., via custom tags like Info).
   */
  variables?: Record<string, any>;
  /**
   * Optional CSS class name(s) to apply to the wrapping div.
   * Defaults to 'prose prose-slate grow' if not provided.
   */
  className?: string;
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
export function DynamicMarkdocRenderer({
  markdocContent,
  variables,
  className = 'prose prose-slate grow', // Default class matching Note.tsx
}: DynamicMarkdocRendererProps) {
  const ast = useMemo(() => parseMarkdoc(markdocContent), [markdocContent]);
  // Memoize the rendering of the static structure from the AST.
  // This avoids re-rendering the base structure if only variables change.
  const renderedContent = useMemo(() => renderMarkdocNode(ast), [ast]);

  return (
    <VariableProvider value={variables ?? {}}>
      <div className={className}>{renderedContent}</div>
    </VariableProvider>
  );
}
