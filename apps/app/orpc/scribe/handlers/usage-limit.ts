import { ORPCError } from "@orpc/server";
import { and, eq, inArray, subscription } from "@repo/database";
import type { Database } from "@repo/database";

import { PRODUCT_PLANS } from "@/lib/product-plans";
import type { ProductPlan } from "@/lib/product-plans";
import { USER_MESSAGES } from "@/lib/user-messages";
import { getUsage } from "@/orpc/scribe/_lib/get-usage";

export interface ScribeEntitlements {
	hasActiveSubscription: boolean;
	plan: ProductPlan;
	scribeUsageLimit: number;
}

export const resolveScribeEntitlements = async (input: {
	db: Database;
	userId: string;
}): Promise<ScribeEntitlements> => {
	const subscriptions = await input.db
		.select()
		.from(subscription)
		.where(
			and(
				eq(subscription.referenceId, input.userId),
				inArray(subscription.status, ["active", "trialing"]),
			),
	);

	const activeSubscription = subscriptions.length > 0;
	const plan: ProductPlan = activeSubscription ? "plus" : "free";

	return {
		hasActiveSubscription: activeSubscription,
		plan,
		scribeUsageLimit: PRODUCT_PLANS[plan].scribeUsageLimit,
	};
};

export const enforceScribeUsageLimit = async (input: {
	db: Database;
	entitlements: ScribeEntitlements;
	session: { user: { id: string } };
}) => {
	const { usage } = await getUsage(input.session, input.db);

	if (usage.count >= input.entitlements.scribeUsageLimit) {
		throw new ORPCError("FORBIDDEN", {
			message: USER_MESSAGES.usageLimitReached,
		});
	}

	return { entitlements: input.entitlements, usage };
};
