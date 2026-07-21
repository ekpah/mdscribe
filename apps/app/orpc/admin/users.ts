import {
	aiScribeFormConfig,
	aiScribeWorkspace,
	and,
	desc,
	gte,
	inArray,
	isNotNull,
	lte,
	sql,
	subscription,
	usageEvent,
	user,
} from "@repo/database";

import { PRODUCT_PLANS } from "@/lib/product-plans";
import { BILLABLE_SCRIBE_USAGE_EVENT_NAMES } from "@/lib/usage-event-names";
import { authed } from "@/orpc";
import { requiredAdminMiddleware } from "@/orpc/middlewares/admin";

const adminUsersHandler = authed.use(requiredAdminMiddleware).handler(async ({ context }) => {
	const now = new Date();
	const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

	const usageQuery = context.db
		.select({
			cost: sql<number>`coalesce(sum(${usageEvent.cost}), 0)::double precision`.as("usageCost"),
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

	const aiScribeFormsQuery = context.db
		.select({
			count: sql<number>`count(*)::int`,
			userId: aiScribeFormConfig.authorId,
		})
		.from(aiScribeFormConfig)
		.where(isNotNull(aiScribeFormConfig.authorId))
		.groupBy(aiScribeFormConfig.authorId);
	const aiScribeWorkspacesQuery = context.db
		.select({
			count: sql<number>`count(*)::int`,
			userId: aiScribeWorkspace.authorId,
		})
		.from(aiScribeWorkspace)
		.where(isNotNull(aiScribeWorkspace.authorId))
		.groupBy(aiScribeWorkspace.authorId);
	const subscriptionsQuery = context.db
		.select({
			plan: subscription.plan,
			referenceId: subscription.referenceId,
			status: subscription.status,
		})
		.from(subscription)
		.orderBy(
			sql`CASE WHEN ${subscription.status} IN ('active', 'trialing') THEN 0 ELSE 1 END`,
			sql`${subscription.periodEnd} DESC NULLS LAST`,
			desc(subscription.createdAt),
		);
	const usersQuery = context.db
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
	const [usageRows, aiScribeFormRows, aiScribeWorkspaceRows, subscriptions, users] =
		await Promise.all([
			usageQuery,
			aiScribeFormsQuery,
			aiScribeWorkspacesQuery,
			subscriptionsQuery,
			usersQuery,
		]);

	const usageByUserId = new Map(
		usageRows.map((row) => [
			row.userId,
			{ cost: Number(row.cost ?? 0), count: Number(row.count ?? 0) },
		]),
	);
	const aiScribeFormsByUserId = new Map(
		aiScribeFormRows.map((row) => [row.userId, Number(row.count ?? 0)]),
	);
	const aiScribeWorkspacesByUserId = new Map(
		aiScribeWorkspaceRows.map((row) => [row.userId, Number(row.count ?? 0)]),
	);
	const subscriptionByUserId = new Map<string, (typeof subscriptions)[number]>();
	for (const currentSubscription of subscriptions) {
		if (!subscriptionByUserId.has(currentSubscription.referenceId)) {
			subscriptionByUserId.set(currentSubscription.referenceId, currentSubscription);
		}
	}

	return users.map((currentUser) => {
		const selectedSubscription = subscriptionByUserId.get(currentUser.id);
		const hasActiveSubscription =
			selectedSubscription?.status === "active" || selectedSubscription?.status === "trialing";
		const effectivePlan = hasActiveSubscription ? "plus" : "free";
		const usage = usageByUserId.get(currentUser.id);

		return {
			...currentUser,
			_count: {
				...currentUser._count,
				aiScribeForms: aiScribeFormsByUserId.get(currentUser.id) ?? 0,
				aiScribeWorkspaces: aiScribeWorkspacesByUserId.get(currentUser.id) ?? 0,
				usageEvents: usage?.count ?? 0,
			},
			hasActiveSubscription,
			monthlyUsageCost: usage?.cost ?? 0,
			monthlyUsageCostLimit: PRODUCT_PLANS[effectivePlan].scribeMonthlyCostLimit,
			subscriptionPlan:
				hasActiveSubscription && selectedSubscription ? selectedSubscription.plan : "free",
			subscriptionStatus: selectedSubscription?.status ?? null,
		};
	});
});

export const usersHandler = {
	list: adminUsersHandler,
};
