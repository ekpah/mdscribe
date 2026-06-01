export const PRODUCT_PLANS = {
	free: {
		canCreatePrivateDocuments: false,
		canCreatePrivateTemplates: false,
		scribeUsageLimit: 50,
	},
	plus: {
		canCreatePrivateDocuments: true,
		canCreatePrivateTemplates: true,
		scribeUsageLimit: 500,
	},
} as const;

export type ProductPlan = keyof typeof PRODUCT_PLANS;
