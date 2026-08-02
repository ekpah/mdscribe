import { ORPCError } from "@orpc/server";
import type { Database } from "@repo/database";

import { resolveProductEntitlements } from "@/lib/product-entitlements";
import type { ProductPlan } from "@/lib/product-plans";
import { resolveMonthlyUsagePeriod } from "@/lib/usage-period";
import { USER_MESSAGES } from "@/lib/user-messages";
import { getMonthlyScribeUsage } from "@/orpc/scribe/_lib/get-usage";

export interface ScribeEntitlements {
	hasActiveSubscription: boolean;
	plan: ProductPlan;
	scribeMonthlyCostLimit: number;
	subscriptionPeriodEnd: Date | null;
	subscriptionPeriodStart: Date | null;
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
		subscriptionPeriodEnd: entitlements.subscriptionPeriodEnd,
		subscriptionPeriodStart: entitlements.subscriptionPeriodStart,
	};
};

export const enforceScribeUsageLimit = async (input: {
	db: Database;
	entitlements: ScribeEntitlements;
	isQuotaExempt?: boolean;
	session: { user: { id: string } };
}) => {
	if (input.isQuotaExempt) {
		return { entitlements: input.entitlements, usage: null };
	}

	const now = new Date();
	const period = resolveMonthlyUsagePeriod({
		hasActiveSubscription: input.entitlements.hasActiveSubscription,
		now,
		subscriptionPeriodEnd: input.entitlements.subscriptionPeriodEnd,
		subscriptionPeriodStart: input.entitlements.subscriptionPeriodStart,
	});
	const usage = await getMonthlyScribeUsage({
		db: input.db,
		now,
		period,
		session: input.session,
	});

	if (usage.totalCost >= input.entitlements.scribeMonthlyCostLimit) {
		throw new ORPCError("FORBIDDEN", {
			message: USER_MESSAGES.usageLimitReached,
		});
	}

	return { entitlements: input.entitlements, usage };
};
