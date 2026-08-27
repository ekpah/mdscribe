export const PRODUCT_PLANS = {
	free: {
		canCreatePrivateAiScribeForms: false,
		canCreatePrivateDocuments: false,
		canCreatePrivateTemplates: false,
		scribeMonthlyCostLimit: 1.5,
	},
	plus: {
		canCreatePrivateAiScribeForms: true,
		canCreatePrivateDocuments: true,
		canCreatePrivateTemplates: true,
		scribeMonthlyCostLimit: 8,
	},
} as const;

export const getScribeUsageBudgetPercentage = (input: {
	monthlyCostLimit: number;
	totalCost: number;
}) => {
	if (input.monthlyCostLimit <= 0) {
		return input.totalCost > 0 ? 100 : 0;
	}

	if (input.totalCost <= 0) {
		return 0;
	}

	return Math.min(100, Math.max(1, Math.round((input.totalCost / input.monthlyCostLimit) * 100)));
};

export type ProductPlan = keyof typeof PRODUCT_PLANS;
