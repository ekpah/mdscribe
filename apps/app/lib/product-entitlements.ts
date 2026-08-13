import { and, desc, eq, inArray, subscription } from "@repo/database";
import type { Database } from "@repo/database";

import { PRODUCT_PLANS } from "@/lib/product-plans";
import type { ProductPlan } from "@/lib/product-plans";

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
	const subscriptions = await input.db
		.select({
			createdAt: subscription.createdAt,
			periodEnd: subscription.periodEnd,
			periodStart: subscription.periodStart,
		})
		.from(subscription)
		.where(
			and(
				eq(subscription.referenceId, input.userId),
				inArray(subscription.status, ["active", "trialing"]),
			),
		)
		.orderBy(desc(subscription.createdAt))
		.limit(1);

	const [activeSubscription] = subscriptions;
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
