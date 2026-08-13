import Formula from "fparser";

/**
 * Parses a score formula and returns its referenced input names.
 *
 * `fparser` throws for malformed expressions. Keeping that behavior in this
 * small helper lets validation report the error while renderers can recover.
 */
export const getFormulaVariables = (formula: string): string[] =>
	new Formula(formula).getVariables();

export const isValidFormula = (formula: string): boolean => {
	try {
		getFormulaVariables(formula);
		return true;
	} catch {
		return false;
	}
};
