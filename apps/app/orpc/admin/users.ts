import { and, desc, eq, gte, lte, sql, usageEvent, user } from "@repo/database";

import { authed } from "@/orpc";
import { requiredAdminMiddleware } from "@/orpc/middlewares/admin";

const SUBSCRIPTION_USAGE_EVENT_NAME = "ai_scribe_generation";

const activeSubscriptionPredicate = sql`
	(
		LOWER(s.status) IN ('active', 'trialing', 'past_due')
		OR (
			LOWER(s.status) IN ('canceled', 'cancelled')
			AND s."periodEnd" IS NOT NULL
			AND s."periodEnd" > NOW()
		)
	)
`;

const adminUsersHandler = authed
	.use(requiredAdminMiddleware)
	.handler(async ({ context }) => {
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
					eq(usageEvent.name, SUBSCRIPTION_USAGE_EVENT_NAME),
					gte(usageEvent.timestamp, firstDayOfMonth),
					lte(usageEvent.timestamp, now),
				),
			)
			.groupBy(usageEvent.userId);

		const usageByUserId = new Map(
			usageRows.map((row) => [row.userId, Number(row.count ?? 0)]),
		);

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
				hasActiveSubscription: sql<boolean>`EXISTS (
					SELECT 1
					FROM "Subscription" s
					WHERE s."referenceId" = ${user.id}
					AND ${activeSubscriptionPredicate}
				)`.as("hasActiveSubscription"),
				id: user.id,
				image: user.image,
				name: user.name,
				subscriptionPlan: sql<string | null>`(
					SELECT s.plan
					FROM "Subscription" s
					WHERE s."referenceId" = ${user.id}
					ORDER BY
						CASE WHEN ${activeSubscriptionPredicate} THEN 0 ELSE 1 END,
						s."periodEnd" DESC NULLS LAST,
						s."createdAt" DESC
					LIMIT 1
				)`.as("subscriptionPlan"),
				subscriptionStatus: sql<string | null>`(
					SELECT s.status
					FROM "Subscription" s
					WHERE s."referenceId" = ${user.id}
					ORDER BY
						CASE WHEN ${activeSubscriptionPredicate} THEN 0 ELSE 1 END,
						s."periodEnd" DESC NULLS LAST,
						s."createdAt" DESC
					LIMIT 1
				)`.as("subscriptionStatus"),
				updatedAt: user.updatedAt,
			})
			.from(user)
			.orderBy(desc(user.createdAt));

		return users.map((currentUser) => ({
			...currentUser,
			_count: {
				...currentUser._count,
				usageEvents: usageByUserId.get(currentUser.id) ?? 0,
			},
		}));
	});

export const usersHandler = {
	list: adminUsersHandler,
};
