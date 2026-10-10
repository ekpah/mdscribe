import { roundNumber } from "../markdoc-config/tags/helpers/round";
import { toBooleanValue } from "./boolean-coercion";
import { toNumericValue } from "./case-conditions";
import { evaluateFormula, getFormulaVariables } from "./formula";
import type { CalcInputTagType, InputTagType } from "./parse-markdoc-to-inputs";

const hasValue = (value: unknown) => value !== undefined && value !== null && value !== "";

const visitInputs = (
	inputs: readonly InputTagType[],
	visit: (input: InputTagType) => void,
): void => {
	for (const input of inputs) {
		visit(input);
		visitInputs(input.children ?? [], visit);
	}
};

/** Collect every named calculation, including calculations in currently hidden branches. */
const collectCalculations = (inputs: InputTagType[]): Map<string, CalcInputTagType> => {
	const calculations = new Map<string, CalcInputTagType>();
	visitInputs(inputs, (input) => {
		if (input.name === "Calc" && input.attributes.primary) {
			calculations.set(input.attributes.primary, input);
		}
	});
	return calculations;
};

/** Numeric case values of one categorical switch variable, merged across all occurrences. */
interface CategoricalMapping {
	boolean: boolean;
	values: Map<string, number>;
}

const collectCategoricalMappings = (inputs: readonly InputTagType[]) => {
	const mappings = new Map<string, CategoricalMapping>();
	visitInputs(inputs, (input) => {
		if (input.name !== "Switch" || !input.attributes.primary) {
			return;
		}
		const mapping = mappings.get(input.attributes.primary) ?? { boolean: false, values: new Map() };
		mapping.boolean ||= input.attributes.type === "boolean" || input.attributes.type === "checkbox";
		for (const option of input.children) {
			if (
				option.name === "Case" &&
				option.attributes.primary &&
				option.attributes.value !== undefined
			) {
				mapping.values.set(option.attributes.primary, option.attributes.value);
			}
		}
		mappings.set(input.attributes.primary, mapping);
	});
	return mappings;
};

/**
 * The number a formula receives: a categorical mapping, booleans as 1/0, or the
 * numeric value. `undefined` means the input is not filled in yet; checkboxes
 * are always filled, since unchecked means false.
 */
const toFormulaNumber = (
	value: unknown,
	mapping: CategoricalMapping | undefined,
): number | undefined => {
	if (mapping?.boolean) {
		const checked = toBooleanValue(value) ?? false;
		return mapping.values.get(String(checked)) ?? (checked ? 1 : 0);
	}
	if (!hasValue(value)) {
		return undefined;
	}
	// An untyped "true"/"false" switch still receives booleans from checkbox controls.
	const key = typeof value === "boolean" ? String(value) : value;
	const mapped = typeof key === "string" ? mapping?.values.get(key) : undefined;
	return mapped ?? toNumericValue(value) ?? 0;
};

/** A calculation's result, or `undefined` until all of its inputs are filled in. */
const evaluateCalculation = (
	input: CalcInputTagType,
	values: Record<string, unknown>,
	mappings: Map<string, CategoricalMapping>,
): number | undefined => {
	const formula = input.attributes.formula ?? "";
	const environment: Record<string, number> = {};
	try {
		for (const name of getFormulaVariables(formula)) {
			const number = toFormulaNumber(values[name], mappings.get(name));
			if (number === undefined) {
				return undefined;
			}
			environment[name] = number;
		}
	} catch {
		return undefined;
	}
	const result = evaluateFormula(formula, environment);
	return typeof result === "number" ? roundNumber(result, input.attributes.round, 2) : undefined;
};

/** Evaluate one calculation using categorical mappings from the complete input registry. */
export const calculateCalcValue = (
	input: CalcInputTagType,
	values: Record<string, unknown>,
	inputs: InputTagType[] = [input],
): number | undefined => evaluateCalculation(input, values, collectCategoricalMappings(inputs));

/**
 * Resolve all named calculations globally, including hidden ones. An explicit
 * value overrides its calculation; both are rounded by the calc's `round`
 * before dependent calculations or conditions consume them. A calculation with
 * missing inputs, including a missing upstream calculation, stays unset.
 */
export const resolveCalculatedValues = (
	inputs: InputTagType[],
	values: Record<string, unknown>,
): Record<string, unknown> => {
	const calculations = collectCalculations(inputs);
	const mappings = collectCategoricalMappings(inputs);
	const resolved = { ...values };
	const done = new Set<string>();
	const visiting: string[] = [];
	const cyclic = new Set<string>();

	const resolve = (name: string): void => {
		const input = calculations.get(name);
		if (!input || done.has(name)) {
			return;
		}
		if (visiting.includes(name)) {
			for (const member of visiting.slice(visiting.indexOf(name))) {
				cyclic.add(member);
			}
			return;
		}
		const explicit = values[name];
		if (hasValue(explicit)) {
			const number = toNumericValue(explicit);
			resolved[name] = number === null ? explicit : roundNumber(number, input.attributes.round, 2);
			done.add(name);
			return;
		}
		visiting.push(name);
		try {
			for (const dependency of getFormulaVariables(input.attributes.formula ?? "")) {
				resolve(dependency);
			}
		} catch {
			/* Stored malformed formulas use the shared tolerant fallback. */
		}
		visiting.pop();
		resolved[name] = cyclic.has(name) ? undefined : evaluateCalculation(input, resolved, mappings);
		done.add(name);
	};

	for (const name of calculations.keys()) {
		resolve(name);
	}
	return resolved;
};
