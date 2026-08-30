import Formula from "fparser";

import { toFormulaValue } from "./boolean-coercion";

/**
 * Parses a calculation formula and returns its referenced input names.
 *
 * `fparser` throws for malformed expressions. Keeping that behavior in this
 * small helper lets validation report the error while renderers can recover.
 */
export const getFormulaVariables = (formula: string): string[] =>
	new Formula(formula).getVariables();

/**
 * Evaluates a formula against a variable map, coercing booleans and
 * boolean-like strings to 1/0. Returns `undefined` when the formula cannot be
 * evaluated (malformed formula or missing/non-numeric inputs) so render paths
 * stay tolerant.
 */
export const evaluateFormula = (
	formula: string,
	variables: Record<string, unknown>,
): number | string | undefined => {
	try {
		const values = Object.fromEntries(
			Object.entries(variables).map(([key, value]) => [key, toFormulaValue(value)]),
		) as Record<string, number | string>;
		const result = new Formula(formula).evaluate(values);
		return typeof result === "number" && !Number.isFinite(result) ? undefined : result;
	} catch {
		return undefined;
	}
};

export const isValidFormula = (formula: string): boolean => {
	try {
		getFormulaVariables(formula);
		return true;
	} catch {
		return false;
	}
};
