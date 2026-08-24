import {
	aiScribeFormConfig,
	aiScribeWorkspace,
	desc,
	isNotNull,
	sql,
	subscription,
	user,
} from "@repo/database";

import { resolveMonthlyUsagePeriod } from "@/lib/usage-period";
import { authed } from "@/orpc";
import { requiredAdminMiddleware } from "@/orpc/middlewares/admin";
import { getMonthlyScribeUsage } from "@/orpc/scribe/_lib/get-usage";
import { resolveScribeEntitlements } from "@/orpc/scribe/handlers/usage-limit";

const adminUsersHandler = authed.use(requiredAdminMiddleware).handler(async ({ context }) => {
	const now = new Date();

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
	const [aiScribeFormRows, aiScribeWorkspaceRows, subscriptions, users] = await Promise.all([
		aiScribeFormsQuery,
		aiScribeWorkspacesQuery,
		subscriptionsQuery,
		usersQuery,
	]);
	const usageByUserId = new Map(
		await Promise.all(
			users.map(async (currentUser) => {
				const entitlements = await resolveScribeEntitlements({
					db: context.db,
					userId: currentUser.id,
				});
				const period = resolveMonthlyUsagePeriod({
					hasActiveSubscription: entitlements.hasActiveSubscription,
					now,
					subscriptionPeriodEnd: entitlements.subscriptionPeriodEnd,
					subscriptionPeriodStart: entitlements.subscriptionPeriodStart,
				});
				const usage = await getMonthlyScribeUsage({
					db: context.db,
					now,
					period,
					session: { user: { id: currentUser.id } },
				});

				return [
					currentUser.id,
					{
						cost: usage.totalCost,
						count: usage.count,
						limit: entitlements.scribeMonthlyCostLimit,
					},
				] as const;
			}),
		),
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
			monthlyUsageCostLimit: usage?.limit ?? 0,
			subscriptionPlan:
				hasActiveSubscription && selectedSubscription ? selectedSubscription.plan : "free",
			subscriptionStatus: selectedSubscription?.status ?? null,
		};
	});
});

export const usersHandler = {
	list: adminUsersHandler,
};
