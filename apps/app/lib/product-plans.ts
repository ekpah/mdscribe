export const PRODUCT_PLANS = {
	free: {
		canCreatePrivateAiScribeForms: false,
		canCreatePrivateDocuments: false,
		canCreatePrivateTemplates: false,
		scribeUsageLimit: 50,
	},
	plus: {
		canCreatePrivateAiScribeForms: true,
		canCreatePrivateDocuments: true,
		canCreatePrivateTemplates: true,
		scribeUsageLimit: 500,
	},
} as const;

export type ProductPlan = keyof typeof PRODUCT_PLANS;
