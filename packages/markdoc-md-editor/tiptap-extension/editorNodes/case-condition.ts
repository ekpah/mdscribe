export const CASE_CONDITION_KEYS = ["eq", "gt", "gte", "lt", "lte"] as const;

/** Case comparisons; arrays align with an array condition primary, `null` skipping a member. */
export interface CaseConditionAttrs {
	eq?: number | (number | null)[];
	gt?: number | (number | null)[];
	gte?: number | (number | null)[];
	lt?: number | (number | null)[];
	lte?: number | (number | null)[];
	isDefault?: boolean;
}

type CaseConditionKey = (typeof CASE_CONDITION_KEYS)[number];

/** The comparisons a case applies to one member: scalar bounds, or one array position. */
export type MemberCondition = Partial<Record<CaseConditionKey, number>>;

export const getMemberCondition = (
	condition: CaseConditionAttrs,
	member: number,
): MemberCondition => {
	const result: MemberCondition = {};
	for (const key of CASE_CONDITION_KEYS) {
		const bound = condition[key];
		const value = Array.isArray(bound) ? bound[member] : member === 0 ? bound : undefined;
		if (typeof value === "number") {
			result[key] = value;
		}
	}
	return result;
};

/** Replaces one member's comparisons of a positional case; all-skip arrays are removed. */
export const setMemberCondition = <T extends CaseConditionAttrs>(
	condition: T,
	member: number,
	memberCount: number,
	next: MemberCondition,
): T => {
	const result = { ...condition };
	for (const key of CASE_CONDITION_KEYS) {
		const current = condition[key];
		const bounds = Array.from({ length: memberCount }, (_, index) =>
			Array.isArray(current) ? (current[index] ?? null) : null,
		);
		bounds[member] = next[key] ?? null;
		result[key] = bounds.some((value) => value !== null) ? bounds : undefined;
	}
	return result;
};

const formatMemberCondition = (condition: MemberCondition): string => {
	if (condition.eq !== undefined) {
		return `= ${condition.eq}`;
	}
	const lower =
		condition.gt !== undefined
			? `> ${condition.gt}`
			: condition.gte !== undefined
				? `≥ ${condition.gte}`
				: "";
	const upper =
		condition.lt !== undefined
			? `< ${condition.lt}`
			: condition.lte !== undefined
				? `≤ ${condition.lte}`
				: "";
	return [lower, upper].filter(Boolean).join(" und ");
};

/** A short case label, e.g. `> 11` or, for an array condition, `ivsd > 11 · lvpwd ≤ 14`. */
export const formatCaseConditionLabel = (
	condition: CaseConditionAttrs,
	members?: readonly string[],
): string | null => {
	if (condition.isDefault) {
		return "Sonst";
	}
	if (!members) {
		return formatMemberCondition(getMemberCondition(condition, 0)) || null;
	}
	return (
		members
			.map((name, index) => {
				const label = formatMemberCondition(getMemberCondition(condition, index));
				return label && `${name || `Feld ${index + 1}`} ${label}`;
			})
			.filter(Boolean)
			.join(" · ") || null
	);
};

export const serializeCaseConditionAttrs = (condition: CaseConditionAttrs): string => {
	return CASE_CONDITION_KEYS.filter((key) => condition[key] !== undefined)
		.map((key) => `${key}=${JSON.stringify(condition[key])}`)
		.concat(condition.isDefault ? ["default=true"] : [])
		.join(" ");
};
