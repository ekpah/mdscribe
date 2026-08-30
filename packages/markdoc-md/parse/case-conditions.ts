/**
 * Structured numeric case conditions for `switch` tags.
 *
 * A number switch selects the first case in document order whose condition
 * matches the resolved numeric value ("first match wins"). Operators on one
 * case combine conjunctively, so `gte=4 lt=10` describes the half-open range
 * [4, 10). A `default=true` case matches unconditionally, including when the
 * value is unset, and must therefore be the last case.
 *
 * This module is the single evaluator shared by the React tags, the input
 * panel, and template validation so they can never disagree.
 */

export const CASE_CONDITION_OPERATORS = ["eq", "gt", "gte", "lt", "lte"] as const;
export type CaseConditionOperator = (typeof CASE_CONDITION_OPERATORS)[number];

export interface CaseCondition {
	default?: boolean;
	eq?: number;
	gt?: number;
	gte?: number;
	lt?: number;
	lte?: number;
}

const toFiniteNumber = (value: unknown): number | undefined =>
	typeof value === "number" && Number.isFinite(value) ? value : undefined;

/**
 * Reads the structured condition from arbitrary case attributes or props.
 * Returns `null` when the case carries no condition (an equality case).
 */
export const toCaseCondition = (
	attributes: Record<string, unknown> | null | undefined,
): CaseCondition | null => {
	if (!attributes || typeof attributes !== "object") {
		return null;
	}
	const condition: CaseCondition = {};
	let present = false;
	for (const operator of CASE_CONDITION_OPERATORS) {
		const value = toFiniteNumber(attributes[operator]);
		if (value !== undefined) {
			condition[operator] = value;
			present = true;
		}
	}
	if (attributes.default === true) {
		condition.default = true;
		present = true;
	}
	return present ? condition : null;
};

/** Whether the given case attributes carry any condition attribute. */
export const hasCaseCondition = (
	attributes: Record<string, unknown> | null | undefined,
): boolean => toCaseCondition(attributes) !== null;

/**
 * Whether a numeric value satisfies a condition. Operators combine
 * conjunctively; a `default` condition matches every value.
 */
export const matchesCaseCondition = (value: number, condition: CaseCondition): boolean => {
	if (condition.default) {
		return true;
	}
	let hasOperator = false;
	if (condition.eq !== undefined) {
		hasOperator = true;
		if (value !== condition.eq) {
			return false;
		}
	}
	if (condition.gt !== undefined) {
		hasOperator = true;
		if (!(value > condition.gt)) {
			return false;
		}
	}
	if (condition.gte !== undefined) {
		hasOperator = true;
		if (!(value >= condition.gte)) {
			return false;
		}
	}
	if (condition.lt !== undefined) {
		hasOperator = true;
		if (!(value < condition.lt)) {
			return false;
		}
	}
	if (condition.lte !== undefined) {
		hasOperator = true;
		if (!(value <= condition.lte)) {
			return false;
		}
	}
	return hasOperator;
};

/**
 * Resolves which case of a number switch is active: the first condition in
 * document order that matches wins. An unset value (`null`) only matches a
 * `default` case. Entries without a condition (`null`) never match.
 */
export const resolveMatchedCaseIndex = (
	value: number | null,
	conditions: readonly (CaseCondition | null)[],
): number | null => {
	for (const [index, condition] of conditions.entries()) {
		if (!condition) {
			continue;
		}
		if (condition.default) {
			return index;
		}
		if (value !== null && matchesCaseCondition(value, condition)) {
			return index;
		}
	}
	return null;
};

/**
 * Coerces a template variable to the numeric value a number switch matches
 * against. Accepts numbers, numeric strings (with a decimal comma or point),
 * and booleans (1/0). Returns `null` when no confident number exists.
 */
export const toNumericSwitchValue = (value: unknown): number | null => {
	if (typeof value === "number") {
		return Number.isFinite(value) ? value : null;
	}
	if (typeof value === "boolean") {
		return value ? 1 : 0;
	}
	if (typeof value !== "string") {
		return null;
	}
	const trimmed = value.trim();
	if (trimmed === "") {
		return null;
	}
	const parsed = Number(trimmed.replace(",", "."));
	return Number.isFinite(parsed) ? parsed : null;
};

/**
 * Canonical, human-readable serialization of a condition. Used for merge keys
 * and editor labels, e.g. `gte=4 lt=10` or `default`.
 */
export const serializeCaseCondition = (condition: CaseCondition): string => {
	if (condition.default) {
		return "default";
	}
	const parts: string[] = [];
	for (const operator of CASE_CONDITION_OPERATORS) {
		const value = condition[operator];
		if (value !== undefined) {
			parts.push(`${operator}=${value}`);
		}
	}
	return parts.join(" ");
};
