export const DASHBOARD_AI_FUNCTION_KEYS = [
	"er",
	"discharge",
	"procedures",
	"icu",
	"outpatient",
	"diagnoseblock",
] as const;

export type DashboardAiFunctionKey = (typeof DASHBOARD_AI_FUNCTION_KEYS)[number];

export const DASHBOARD_AI_FUNCTION_USAGE_ENDPOINTS: Record<
	DashboardAiFunctionKey,
	readonly string[]
> = {
	diagnoseblock: ["diagnosis", "custom:builtin-diagnoseblock"],
	discharge: ["discharge", "custom:builtin-discharge"],
	er: ["anamnese", "custom:builtin-er"],
	icu: ["icu-transfer", "custom:builtin-icu"],
	outpatient: ["outpatient", "custom:builtin-outpatient"],
	procedures: ["procedures", "custom:builtin-procedures"],
};

export const DASHBOARD_AI_FUNCTION_ENDPOINTS = Object.values(
	DASHBOARD_AI_FUNCTION_USAGE_ENDPOINTS,
).flat();

interface AiFunctionUsageCount {
	count: number;
	endpoint: string | null;
}

const getFunctionKeyForEndpoint = (endpoint: string | null): DashboardAiFunctionKey | undefined => {
	if (!endpoint) {
		return undefined;
	}

	return DASHBOARD_AI_FUNCTION_KEYS.find((key) =>
		DASHBOARD_AI_FUNCTION_USAGE_ENDPOINTS[key].includes(endpoint),
	);
};

const rankFunctionKeys = (usage: AiFunctionUsageCount[]): DashboardAiFunctionKey[] => {
	const counts = new Map<DashboardAiFunctionKey, number>();

	for (const row of usage) {
		const key = getFunctionKeyForEndpoint(row.endpoint);
		if (key) {
			counts.set(key, (counts.get(key) ?? 0) + row.count);
		}
	}

	return DASHBOARD_AI_FUNCTION_KEYS.filter((key) => counts.has(key)).toSorted((left, right) => {
		const countDifference = (counts.get(right) ?? 0) - (counts.get(left) ?? 0);
		return (
			countDifference ||
			DASHBOARD_AI_FUNCTION_KEYS.indexOf(left) - DASHBOARD_AI_FUNCTION_KEYS.indexOf(right)
		);
	});
};

export const selectDashboardAiFunctions = ({
	globalUsage,
	limit = 3,
	userUsage,
}: {
	globalUsage: AiFunctionUsageCount[];
	limit?: number;
	userUsage: AiFunctionUsageCount[];
}): DashboardAiFunctionKey[] => {
	const selected = [
		...rankFunctionKeys(userUsage),
		...rankFunctionKeys(globalUsage),
		...DASHBOARD_AI_FUNCTION_KEYS,
	];

	return [...new Set(selected)].slice(0, limit);
};
