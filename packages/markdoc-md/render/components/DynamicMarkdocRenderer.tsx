import React from 'react';
import { VariableProvider } from '../context/VariableContext';
import { parseMarkdoc, renderMarkdocNode } from '../renderNote';
import parseMarkdocToInputs from '../../parse/parseMarkdocToInputs';

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
  // Memoize the parsed AST based on the content string.
  // This avoids re-parsing if only variables change.
  const ast = React.useMemo(
    () => parseMarkdoc(markdocContent),
    [markdocContent]
  );

  // Parse the markdoc content to extract input tags and their types
  const { inputTags } = React.useMemo(
    () => parseMarkdocToInputs(markdocContent),
    [markdocContent]
  );

  // Process variables based on their defined types
  const typedVariables = React.useMemo(() => {
    if (!variables) return {};
    
    // Create a map of variable names to their defined types
    const typeMap = new Map<string, string | undefined>();
    inputTags.forEach((tag) => {
      if (tag.type === 'info') {
        typeMap.set(tag.options.name, tag.options.type);
      }
    });
    
    // Convert variables to their proper types based on the type map
    return Object.entries(variables).reduce((acc, [key, value]) => {
      const type = typeMap.get(key);
      
      if (type === 'number' && typeof value === 'string') {
        const numValue = Number(value);
        acc[key] = isNaN(numValue) ? 0 : numValue;
      } else if (type === 'boolean' && typeof value === 'string') {
        acc[key] = value.toLowerCase() === 'true';
      } else {
        acc[key] = value;
      }
      
      return acc;
    }, {} as Record<string, any>);
  }, [variables, inputTags]);

  // Memoize the rendering of the static structure from the AST.
  // This avoids re-rendering the base structure if only variables change.
  const renderedContent = React.useMemo(() => renderMarkdocNode(ast), [ast]);

  return (
    <VariableProvider value={typedVariables ?? {}}>
      <div className={className}>{renderedContent}</div>
    </VariableProvider>
  );
}
