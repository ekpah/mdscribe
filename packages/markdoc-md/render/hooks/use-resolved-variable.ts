import { evaluateFormula } from "../../parse/formula";
import type { VariableContract } from "../../parse/validate-markdoc-tag-contracts";
import type { VariableValue } from "../context/variable-context";
import { useVariables } from "../context/variable-context";
import { useVariableContract } from "../context/variable-contract-context";

export interface ResolvedVariable {
	/** The variable's contract when rendered inside DynamicMarkdocRenderer. */
	contract?: VariableContract;
	/** True when the value came from a formula instead of a stored variable. */
	isComputed: boolean;
	value: VariableValue;
}

const hasValue = (value: VariableValue): boolean =>
	value !== undefined && value !== null && value !== "";

/**
 * Single read path for template variables: a stored (or manually overridden)
 * value wins; otherwise a computed variable derives its value from its
 * formula. Components format the result themselves.
 *
 * `options.formula` lets a tag that carries its own formula (calc) resolve
 * without a contract provider.
 */
export const useResolvedVariable = (
	name?: string | null,
	options?: { formula?: string },
): ResolvedVariable => {
	const variables = useVariables();
	const contract = useVariableContract(name);

	const raw = name ? variables[name] : undefined;
	if (hasValue(raw)) {
		return { contract, isComputed: false, value: raw };
	}

	const formula =
		options?.formula ?? (contract?.roles.computed ? contract.formula : undefined);
	if (formula) {
		const computed = evaluateFormula(formula, variables);
		return { contract, isComputed: true, value: computed };
	}

	return { contract, isComputed: false, value: raw };
};
