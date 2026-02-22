import { desc, sql, user } from "@repo/database";

import { authed } from "@/orpc";
import { requiredAdminMiddleware } from "../middlewares/admin";

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
		const users = await context.db
			.select({
				id: user.id,
				name: user.name,
				email: user.email,
				emailVerified: user.emailVerified,
				image: user.image,
				createdAt: user.createdAt,
				updatedAt: user.updatedAt,
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
				hasActiveSubscription: sql<boolean>`EXISTS (
					SELECT 1
					FROM "Subscription" s
					WHERE s."referenceId" = ${user.id}
					AND ${activeSubscriptionPredicate}
				)`.as("hasActiveSubscription"),
				_count: {
					templates: sql<number>`(
						SELECT COUNT(*) FROM "Template"
						WHERE "Template"."authorId" = ${user.id}
					)::int`.as("templatesCount"),
					favourites: sql<number>`(
						SELECT COUNT(*) FROM "_favourites"
						WHERE "_favourites"."B" = ${user.id}
					)::int`.as("favouritesCount"),
					usageEvents: sql<number>`(
						SELECT COUNT(*)
						FROM "UsageEvent"
						WHERE "UsageEvent"."userId" = ${user.id}
						AND (
							"UsageEvent".name LIKE 'ai\_%' ESCAPE '\\'
							OR "UsageEvent".name = 'admin_scribe_playground'
						)
					)::int`.as("usageEventsCount"),
				},
			})
			.from(user)
			.orderBy(desc(user.createdAt));

		return users;
	});

export const usersHandler = {
	list: adminUsersHandler,
};
