import React, { createContext, useContext } from "react";

// Define the shape of your variables object to support multiple types
export type VariableValue = string | number | boolean | null | undefined;
export type VariableMap = Record<string, VariableValue>;

type VariableContextType = Record<string, VariableValue>;

const VariableContext = createContext<VariableContextType>({});

export const VariableProvider = VariableContext.Provider;

/**
 * Hook to access the Markdoc variables within custom components.
 * Must be used within a component wrapped by VariableProvider (typically via DynamicMarkdocRenderer).
 */
export const useVariables = (): VariableMap => {
	return useContext(VariableContext);
};
