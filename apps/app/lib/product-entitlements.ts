import { and, eq, inArray, subscription } from "@repo/database";
import type { Database } from "@repo/database";

import { PRODUCT_PLANS } from "@/lib/product-plans";
import type { ProductPlan } from "@/lib/product-plans";

interface ProductEntitlements {
	canCreatePrivateAiScribeForms: boolean;
	canCreatePrivateDocuments: boolean;
	canCreatePrivateTemplates: boolean;
	hasActiveSubscription: boolean;
	plan: ProductPlan;
	scribeUsageLimit: number;
}

export const resolveProductEntitlements = async (input: {
	db: Database;
	userId: string;
}): Promise<ProductEntitlements> => {
	const subscriptions = await input.db
		.select({ id: subscription.id })
		.from(subscription)
		.where(
			and(
				eq(subscription.referenceId, input.userId),
				inArray(subscription.status, ["active", "trialing"]),
			),
		);

	const hasActiveSubscription = subscriptions.length > 0;
	const plan: ProductPlan = hasActiveSubscription ? "plus" : "free";
	const planEntitlements = PRODUCT_PLANS[plan];

	return {
		canCreatePrivateAiScribeForms: planEntitlements.canCreatePrivateAiScribeForms,
		canCreatePrivateDocuments: planEntitlements.canCreatePrivateDocuments,
		canCreatePrivateTemplates: planEntitlements.canCreatePrivateTemplates,
		hasActiveSubscription,
		plan,
		scribeUsageLimit: planEntitlements.scribeUsageLimit,
	};
};
