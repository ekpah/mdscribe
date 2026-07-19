import { ORPCError } from "@orpc/server";
import type { Database } from "@repo/database";

import { resolveProductEntitlements } from "@/lib/product-entitlements";
import type { ProductPlan } from "@/lib/product-plans";
import { USER_MESSAGES } from "@/lib/user-messages";
import { getMonthlyScribeUsage } from "@/orpc/scribe/_lib/get-usage";

export interface ScribeEntitlements {
	hasActiveSubscription: boolean;
	plan: ProductPlan;
	scribeMonthlyCostLimit: number;
}

export const resolveScribeEntitlements = async (input: {
	db: Database;
	userId: string;
}): Promise<ScribeEntitlements> => {
	const entitlements = await resolveProductEntitlements(input);

	return {
		hasActiveSubscription: entitlements.hasActiveSubscription,
		plan: entitlements.plan,
		scribeMonthlyCostLimit: entitlements.scribeMonthlyCostLimit,
	};
};

export const enforceScribeUsageLimit = async (input: {
	db: Database;
	entitlements: ScribeEntitlements;
	session: { user: { id: string } };
}) => {
	const usage = await getMonthlyScribeUsage({
		db: input.db,
		session: input.session,
	});

	if (usage.totalCost >= input.entitlements.scribeMonthlyCostLimit) {
		throw new ORPCError("FORBIDDEN", {
			message: USER_MESSAGES.usageLimitReached,
		});
	}

	return { entitlements: input.entitlements, usage };
};
