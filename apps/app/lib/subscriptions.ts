import "server-only";
import type { Subscription } from "@better-auth/stripe";
import { and, desc, eq, inArray, subscription } from "@repo/database";
import type { Database } from "@repo/database";
import { database } from "@repo/database/client";

import { subscriptionsEnabled } from "@/lib/stripe-config";

type ActiveSubscription = Subscription & { createdAt: Date };

export const getActiveSubscription = async (input: {
	db?: Database;
	userId: string;
}): Promise<ActiveSubscription | null> => {
	if (!subscriptionsEnabled) {
		return null;
	}

	const [activeSubscription] = await (input.db ?? database)
		.select()
		.from(subscription)
		.where(
			and(
				eq(subscription.referenceId, input.userId),
				inArray(subscription.status, ["active", "trialing"]),
			),
		)
		.orderBy(desc(subscription.createdAt))
		.limit(1);

	return activeSubscription
		? {
				...activeSubscription,
				cancelAtPeriodEnd: activeSubscription.cancelAtPeriodEnd ?? undefined,
				periodEnd: activeSubscription.periodEnd ?? undefined,
				periodStart: activeSubscription.periodStart ?? undefined,
				seats: activeSubscription.seats ?? undefined,
				status: activeSubscription.status as Subscription["status"],
				stripeCustomerId: activeSubscription.stripeCustomerId ?? undefined,
				stripeSubscriptionId: activeSubscription.stripeSubscriptionId ?? undefined,
				trialEnd: activeSubscription.trialEnd ?? undefined,
				trialStart: activeSubscription.trialStart ?? undefined,
			}
		: null;
};
