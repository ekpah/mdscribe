import { and, desc, eq, inArray, subscription } from "@repo/database";
import type { Database } from "@repo/database";

import type { LicenseEdition } from "@/lib/license/types";
import { resolveLicense } from "@/lib/license/verify";
import { PRODUCT_PLANS } from "@/lib/product-plans";
import type { ProductPlan } from "@/lib/product-plans";

interface ProductEntitlements {
	canCreatePrivateAiScribeForms: boolean;
	canCreatePrivateDocuments: boolean;
	canCreatePrivateTemplates: boolean;
	/** Deployment edition from the license key (cheap; no seat count here). */
	edition: LicenseEdition;
	hasActiveSubscription: boolean;
	/** Whether a configured license key has expired (functional; warn only). */
	licenseExpired: boolean;
	licensee: string | null;
	/** Licensed seat cap, or `null` for unlimited / community. */
	maxSeats: number | null;
	plan: ProductPlan;
	scribeMonthlyCostLimit: number;
	subscriptionPeriodEnd: Date | null;
	subscriptionPeriodStart: Date | null;
}

export const resolveProductEntitlements = async (input: {
	db: Database;
	userId: string;
}): Promise<ProductEntitlements> => {
	const [subscriptions, license] = await Promise.all([
		input.db
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
			.limit(1),
		resolveLicense(),
	]);

	const [activeSubscription] = subscriptions;
	const hasActiveSubscription = Boolean(activeSubscription);
	const plan: ProductPlan = hasActiveSubscription ? "plus" : "free";
	const planEntitlements = PRODUCT_PLANS[plan];

	return {
		canCreatePrivateAiScribeForms: planEntitlements.canCreatePrivateAiScribeForms,
		canCreatePrivateDocuments: planEntitlements.canCreatePrivateDocuments,
		canCreatePrivateTemplates: planEntitlements.canCreatePrivateTemplates,
		edition: license?.edition ?? "community",
		hasActiveSubscription,
		licenseExpired: license?.isExpired ?? false,
		licensee: license?.licensee ?? null,
		maxSeats: license?.maxSeats ?? null,
		plan,
		scribeMonthlyCostLimit: planEntitlements.scribeMonthlyCostLimit,
		subscriptionPeriodEnd: activeSubscription?.periodEnd ?? null,
		subscriptionPeriodStart:
			activeSubscription?.periodStart ?? activeSubscription?.createdAt ?? null,
	};
};
