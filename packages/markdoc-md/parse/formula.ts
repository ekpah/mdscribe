import Formula from "fparser";

import { toFormulaValue } from "./boolean-coercion";

/**
 * Parses a calculation formula and returns its referenced input names.
 *
 * `fparser` throws for malformed expressions. Keeping that behavior in this
 * small helper lets validation report the error while renderers can recover.
 */
export const getFormulaVariables = (formula: string): string[] =>
	// fparser reports its constants (PI, E, …) as variables; they are not inputs.
	new Formula(formula)
		.getVariables()
		.filter((name) => !Object.hasOwn(Formula.MATH_CONSTANTS, name));

/**
 * Evaluates a formula against a variable map, coercing booleans and
 * boolean-like strings to 1/0. Returns `undefined` when the formula cannot be
 * evaluated (malformed formula, an input that is not filled in, or a
 * non-finite result) so render paths stay tolerant.
 */
export const evaluateFormula = (
	formula: string,
	variables: Record<string, unknown>,
): number | string | undefined => {
	try {
		for (const name of getFormulaVariables(formula)) {
			const value = variables[name];
			if (value === undefined || value === null || value === "") {
				return undefined;
			}
		}
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

const SIMPLE_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/u;
const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");

/**
 * Renames a variable in a formula, both as `[name]` and as a bare name; a new
 * name that is not a simple identifier is written in brackets. Only bracketed
 * references are rewritten when a bare rename would affect another variable.
 */
export const renameFormulaVariable = (formula: string, from: string, to: string): string => {
	if (!from || from === to) {
		return formula;
	}
	let variables: string[];
	try {
		variables = getFormulaVariables(formula);
	} catch {
		variables = [];
	}
	const replacement = `[${to}]`;
	const bracketed = formula.replace(new RegExp(`\\[${escapeRegExp(from)}\\]`, "gu"), replacement);
	if (!variables.includes(from)) {
		return bracketed;
	}
	const renamed = bracketed.replace(
		new RegExp(`(?<![\\p{L}\\p{N}_.\\[])${escapeRegExp(from)}(?![\\p{L}\\p{N}_.(\\]])`, "gu"),
		SIMPLE_NAME.test(to) ? to : replacement,
	);
	try {
		const expected = new Set(variables.map((name) => (name === from ? to : name)));
		const actual = new Set(getFormulaVariables(renamed));
		// A bare name may also have matched elsewhere; then only brackets are safe.
		return actual.size === expected.size && [...actual].every((name) => expected.has(name))
			? renamed
			: bracketed;
	} catch {
		// The new name is not valid in formulas; keep the reference so validation reports it.
		return renamed;
	}
};
