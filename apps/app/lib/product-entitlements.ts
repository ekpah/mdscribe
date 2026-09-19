import type { Database } from "@repo/database";

import { PRODUCT_PLANS } from "@/lib/product-plans";
import type { ProductPlan } from "@/lib/product-plans";
import { getActiveSubscription } from "@/lib/subscriptions";

interface ProductEntitlements {
	canCreatePrivateAiScribeForms: boolean;
	canCreatePrivateDocuments: boolean;
	canCreatePrivateTemplates: boolean;
	hasActiveSubscription: boolean;
	plan: ProductPlan;
	scribeMonthlyCostLimit: number;
	subscriptionPeriodEnd: Date | null;
	subscriptionPeriodStart: Date | null;
}

export const resolveProductEntitlements = async (input: {
	db: Database;
	userId: string;
}): Promise<ProductEntitlements> => {
	const activeSubscription = await getActiveSubscription(input);
	const hasActiveSubscription = Boolean(activeSubscription);
	const plan: ProductPlan = hasActiveSubscription ? "plus" : "free";
	const planEntitlements = PRODUCT_PLANS[plan];

	return {
		canCreatePrivateAiScribeForms: planEntitlements.canCreatePrivateAiScribeForms,
		canCreatePrivateDocuments: planEntitlements.canCreatePrivateDocuments,
		canCreatePrivateTemplates: planEntitlements.canCreatePrivateTemplates,
		hasActiveSubscription,
		plan,
		scribeMonthlyCostLimit: planEntitlements.scribeMonthlyCostLimit,
		subscriptionPeriodEnd: activeSubscription?.periodEnd ?? null,
		subscriptionPeriodStart:
			activeSubscription?.periodStart ?? activeSubscription?.createdAt ?? null,
	};
};
