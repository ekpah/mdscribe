export interface CaseConditionAttrs {
	eq?: number;
	gt?: number;
	gte?: number;
	lt?: number;
	lte?: number;
	isDefault?: boolean;
}

export const formatCaseConditionLabel = (condition: CaseConditionAttrs): string | null => {
	if (condition.isDefault) return "Sonst";
	if (typeof condition.eq === "number") return `= ${condition.eq}`;
	const lower =
		typeof condition.gt === "number"
			? `> ${condition.gt}`
			: typeof condition.gte === "number"
				? `≥ ${condition.gte}`
				: "";
	const upper =
		typeof condition.lt === "number"
			? `< ${condition.lt}`
			: typeof condition.lte === "number"
				? `≤ ${condition.lte}`
				: "";
	return [lower, upper].filter(Boolean).join(" und ") || null;
};

export const serializeCaseConditionAttrs = (condition: CaseConditionAttrs): string => {
	if (condition.isDefault) return "default=true";
	return (["eq", "gt", "gte", "lt", "lte"] as const)
		.filter((key) => typeof condition[key] === "number")
		.map((key) => `${key}=${condition[key]}`)
		.join(" ");
};
