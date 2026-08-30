import React, { createContext, useContext } from "react";

import type { VariableContract } from "../../parse/validate-markdoc-tag-contracts";

type VariableContractMap = ReadonlyMap<string, VariableContract>;

const VariableContractContext = createContext<VariableContractMap | null>(null);

/**
 * Provides the template's variable contracts to the rendered tag components.
 * DynamicMarkdocRenderer derives the map once per template. Components must
 * stay functional without this provider (headless renderMarkdocAsReact use).
 */
export const VariableContractProvider = VariableContractContext.Provider;

/** The contract of one variable, or undefined outside a provider. */
export const useVariableContract = (name?: string | null): VariableContract | undefined => {
	const contracts = useContext(VariableContractContext);
	if (!contracts || !name) {
		return undefined;
	}
	return contracts.get(name);
};
