import React, { createContext, useContext } from 'react';

// Define the shape of your variables object to support multiple types
type VariableValue = string | number | Date | boolean;
type VariableMap = Record<string, VariableValue>;

type VariableContextType = Record<string, VariableValue>;

const VariableContext = createContext<VariableContextType>({});

export const VariableProvider = VariableContext.Provider;

/**
 * Hook to access the Markdoc variables within custom components.
 * Must be used within a component wrapped by VariableProvider (typically via DynamicMarkdocRenderer).
 */
export function useVariables(): VariableMap {
  const context = useContext(VariableContext);
  if (context === undefined) {
    throw new Error('useVariables must be used within a VariableProvider');
  }
  return context;
}
