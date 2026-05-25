export const PRODUCT_PLANS = {
	free: {
		scribeUsageLimit: 50,
	},
	plus: {
		scribeUsageLimit: 500,
	},
} as const;

export type ProductPlan = keyof typeof PRODUCT_PLANS;
