import {
	and,
	database,
	eq,
	gte,
	lte,
	sql,
	subscription,
	usageEvent,
} from "@repo/database";

export async function getUsage(
	session: { user: { id: string } },
	db: typeof database = database,
) {
	const now = new Date();
	const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

	const usage = await db
		.select({
			totalTokens: usageEvent.totalTokens,
			inputTokens: usageEvent.inputTokens,
			outputTokens: usageEvent.outputTokens,
			cost: usageEvent.cost,
			model: usageEvent.model,
		})
		.from(usageEvent)
		.where(
			and(
				eq(usageEvent.userId, session.user.id),
				gte(usageEvent.timestamp, firstDayOfMonth),
				lte(usageEvent.timestamp, now),
				eq(usageEvent.name, "ai_scribe_generation"),
			),
		);

	const totalTokens = usage.reduce(
		(acc, event) => acc + (event.totalTokens ?? 0),
		0,
	);

	const totalInputTokens = usage.reduce(
		(acc, event) => acc + (event.inputTokens ?? 0),
		0,
	);

	const totalOutputTokens = usage.reduce(
		(acc, event) => acc + (event.outputTokens ?? 0),
		0,
	);

	const totalCost = usage.reduce(
		(acc, event) => acc + Number(event.cost ?? 0),
		0,
	);

	// Group by model for detailed breakdown
	const byModel = usage.reduce(
		(acc, event) => {
			const model = event.model ?? "unknown";
			if (!acc[model]) {
				acc[model] = { count: 0, tokens: 0, cost: 0 };
			}
			acc[model].count++;
			acc[model].tokens += event.totalTokens ?? 0;
			acc[model].cost += Number(event.cost ?? 0);
			return acc;
		},
		{} as Record<string, { count: number; tokens: number; cost: number }>,
	);

	const usageCount = usage.length;

	const activeSubscription = await db
		.select({ id: subscription.id })
		.from(subscription)
		.where(
			and(
				eq(subscription.referenceId, session.user.id),
				sql`${subscription.status} IN ('active', 'trialing')`,
			),
		)
		.limit(1);

	const hasActiveSubscription = activeSubscription.length > 0;
	const monthlyUsageLimit = hasActiveSubscription ? 500 : 50;
	const remainingGenerations = Math.max(0, monthlyUsageLimit - usageCount);
	const remainingRatio =
		monthlyUsageLimit > 0 ? remainingGenerations / monthlyUsageLimit : 0;
	const isLow = remainingRatio <= 0.1;
	const isDepleted = remainingGenerations === 0;

	return {
		usage: {
			count: usageCount,
			totalTokens,
			totalInputTokens,
			totalOutputTokens,
			totalCost,
			byModel,
		},
		limits: {
			hasActiveSubscription,
			monthlyUsageLimit,
			remainingGenerations,
			isLow,
			isDepleted,
		},
	};
}
