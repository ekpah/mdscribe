/**
 * Structured numeric case conditions for `condition` tags.
 *
 * A condition selects the first case in document order whose comparisons all
 * match ("first match wins"). A scalar primary uses scalar bounds (`gt=11`);
 * an array primary uses positional bounds with one entry per member, where
 * `null` skips that member (`gt=[11,null]`). Operators within one case combine
 * conjunctively, so `gte=4 lt=10` describes the half-open range [4, 10). A
 * `default=true` case carries no comparisons, matches unconditionally
 * (including unset values), and must therefore be the last case.
 *
 * This module is the single evaluator shared by the React tags, the input
 * panel, and template validation so they can never disagree.
 */

export const CASE_CONDITION_OPERATORS = ["eq", "gt", "gte", "lt", "lte"] as const;
export type CaseConditionOperator = (typeof CASE_CONDITION_OPERATORS)[number];

/** The comparisons a case applies to one primary member. */
export type CaseCondition = Partial<Record<CaseConditionOperator, number>>;

/** A condition case normalized to one comparison set per primary member. */
export interface ConditionCase {
	default: boolean;
	/** Positional comparisons; `null` skips that member. */
	members: (CaseCondition | null)[];
}

/** Why stored case attributes do not form a condition case. Malformed cases never match. */
export type MalformedConditionCase =
	| "conflicting-operators"
	| "invalid-literal"
	| "missing-condition";

/** Normalizes scalar and positional case attributes against the condition's primary. */
export const parseConditionCase = (
	attributes: Record<string, unknown>,
	primary: unknown,
): ConditionCase | MalformedConditionCase => {
	const positional = Array.isArray(primary);
	const length = positional ? primary.length : 1;
	if (attributes.default !== undefined && typeof attributes.default !== "boolean") {
		return "invalid-literal";
	}
	const members: (CaseCondition | null)[] = Array.from({ length }, () => null);
	let hasComparison = false;
	for (const operator of CASE_CONDITION_OPERATORS) {
		const raw = attributes[operator];
		if (raw === undefined) {
			continue;
		}
		const bounds = positional ? raw : [raw];
		if (!Array.isArray(bounds) || bounds.length !== length) {
			return "invalid-literal";
		}
		for (const [index, bound] of bounds.entries()) {
			if (positional && bound === null) {
				continue;
			}
			if (typeof bound !== "number" || !Number.isFinite(bound)) {
				return "invalid-literal";
			}
			members[index] = { ...members[index], [operator]: bound };
			hasComparison = true;
		}
	}
	const isDefault = attributes.default === true;
	if (isDefault && hasComparison) {
		return "conflicting-operators";
	}
	if (!isDefault && !hasComparison) {
		return "missing-condition";
	}
	return { default: isDefault, members };
};

/** Whether a numeric value satisfies every comparison of a member condition. */
export const matchesCaseCondition = (value: number, condition: CaseCondition): boolean =>
	(condition.eq === undefined || value === condition.eq) &&
	(condition.gt === undefined || value > condition.gt) &&
	(condition.gte === undefined || value >= condition.gte) &&
	(condition.lt === undefined || value < condition.lt) &&
	(condition.lte === undefined || value <= condition.lte);

/**
 * Coerces a template variable to the number conditions and formulas use.
 * Accepts numbers, numeric strings (with a decimal comma or point), and
 * booleans (1/0). Returns `null` when no confident number exists.
 */
export const toNumericValue = (value: unknown): number | null => {
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

/** The member names of a condition primary, or `null` when empty, blank, or repeated. */
export const toConditionMembers = (primary: unknown): string[] | null => {
	const names = Array.isArray(primary) ? primary : [primary];
	return names.length > 0 &&
		names.every((name) => typeof name === "string" && name.trim()) &&
		new Set(names).size === names.length
		? (names as string[])
		: null;
};

/**
 * Index of the first matching case, or `null`. A compared member with a
 * missing value fails its case; skipped members may be missing.
 */
export const selectConditionCase = (
	primary: unknown,
	cases: readonly Record<string, unknown>[],
	values: Record<string, unknown>,
): number | null => {
	const names = toConditionMembers(primary);
	if (!names) {
		return null;
	}
	const numbers = names.map((name) => toNumericValue(values[name]));
	const index = cases.findIndex((attributes) => {
		const condition = parseConditionCase(attributes, primary);
		if (typeof condition === "string") {
			return false;
		}
		return (
			condition.default ||
			condition.members.every((member, position) => {
				const value = numbers[position];
				return member === null || (value != null && matchesCaseCondition(value, member));
			})
		);
	});
	return index < 0 ? null : index;
};
