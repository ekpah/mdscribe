import { and, desc, gte, inArray, lte, sql, subscription, usageEvent, user } from "@repo/database";

import { BILLABLE_SCRIBE_USAGE_EVENT_NAMES } from "@/lib/usage-event-names";
import { authed } from "@/orpc";
import { requiredAdminMiddleware } from "@/orpc/middlewares/admin";

const adminUsersHandler = authed.use(requiredAdminMiddleware).handler(async ({ context }) => {
	const now = new Date();
	const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

	const usageRows = await context.db
		.select({
			count: sql<number>`count(*)::int`.as("usageEventsCount"),
			userId: usageEvent.userId,
		})
		.from(usageEvent)
		.where(
			and(
				inArray(usageEvent.name, [...BILLABLE_SCRIBE_USAGE_EVENT_NAMES]),
				gte(usageEvent.timestamp, firstDayOfMonth),
				lte(usageEvent.timestamp, now),
			),
		)
		.groupBy(usageEvent.userId);

	const usageByUserId = new Map(usageRows.map((row) => [row.userId, Number(row.count ?? 0)]));

	const subscriptions = await context.db
		.select({
			referenceId: subscription.referenceId,
			status: subscription.status,
		})
		.from(subscription)
		.orderBy(
			sql`CASE WHEN ${subscription.status} IN ('active', 'trialing') THEN 0 ELSE 1 END`,
			sql`${subscription.periodEnd} DESC NULLS LAST`,
			desc(subscription.createdAt),
		);
	const subscriptionByUserId = new Map<string, (typeof subscriptions)[number]>();
	for (const currentSubscription of subscriptions) {
		if (!subscriptionByUserId.has(currentSubscription.referenceId)) {
			subscriptionByUserId.set(currentSubscription.referenceId, currentSubscription);
		}
	}

	const users = await context.db
		.select({
			_count: {
				favourites: sql<number>`(
						SELECT COUNT(*) FROM "_favourites"
						WHERE "_favourites"."B" = ${user.id}
					)::int`.as("favouritesCount"),
				templates: sql<number>`(
						SELECT COUNT(*) FROM "Template"
						WHERE "Template"."authorId" = ${user.id}
					)::int`.as("templatesCount"),
				usageEvents: sql<number>`(
						0
					)::int`.as("usageEventsCount"),
			},
			createdAt: user.createdAt,
			email: user.email,
			emailVerified: user.emailVerified,
			id: user.id,
			image: user.image,
			name: user.name,
			updatedAt: user.updatedAt,
		})
		.from(user)
		.orderBy(desc(user.createdAt));

	return users.map((currentUser) => {
		const selectedSubscription = subscriptionByUserId.get(currentUser.id);
		const hasActiveSubscription =
			selectedSubscription?.status === "active" || selectedSubscription?.status === "trialing";

		return {
			...currentUser,
			_count: {
				...currentUser._count,
				usageEvents: usageByUserId.get(currentUser.id) ?? 0,
			},
			hasActiveSubscription,
			subscriptionPlan: hasActiveSubscription ? ("plus" as const) : ("free" as const),
			subscriptionStatus: selectedSubscription?.status ?? null,
		};
	});
});

export const usersHandler = {
	list: adminUsersHandler,
};
