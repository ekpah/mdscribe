import { ORPCError } from "@orpc/server";
import { and, eq, inArray, subscription } from "@repo/database";
import type { Database } from "@repo/database";

import { USER_MESSAGES } from "@/lib/user-messages";
import { getUsage } from "@/orpc/scribe/_lib/get-usage";

const FREE_TIER_USAGE_LIMIT = 50;
const PLUS_TIER_USAGE_LIMIT = 500;

export const resolveScribeUsageLimit = (hasActiveSubscription: boolean): number =>
	hasActiveSubscription ? PLUS_TIER_USAGE_LIMIT : FREE_TIER_USAGE_LIMIT;

export const enforceScribeUsageLimit = async (input: {
	db: Database;
	session: { user: { id: string } };
	userId: string;
}) => {
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
	const usageLimit = resolveScribeUsageLimit(activeSubscription);
	const { usage } = await getUsage(input.session, input.db);

	if (usage.count >= usageLimit) {
		throw new ORPCError("FORBIDDEN", {
			message: USER_MESSAGES.usageLimitReached,
		});
	}

	return { activeSubscription, usage };
};
