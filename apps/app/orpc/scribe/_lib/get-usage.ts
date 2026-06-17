import { and, eq, gte, inArray, lte, usageEvent } from "@repo/database";
import type { Database } from "@repo/database";
import { database } from "@repo/database/client";
import { resolveProductEntitlements } from "@/lib/product-entitlements";
import { getScribeUsageBudgetPercentage } from "@/lib/product-plans";
import { BILLABLE_SCRIBE_USAGE_EVENT_NAMES } from "@/lib/usage-event-names";

export const getMonthlyScribeUsage = async (input: {
	db?: Database;
	session: { user: { id: string } };
}) => {
	const db = input.db ?? database;
	const now = new Date();
	const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

	const usage = await db
		.select({
			cost: usageEvent.cost,
			inputTokens: usageEvent.inputTokens,
			model: usageEvent.model,
			outputTokens: usageEvent.outputTokens,
			totalTokens: usageEvent.totalTokens,
		})
		.from(usageEvent)
		.where(
			and(
				eq(usageEvent.userId, input.session.user.id),
				gte(usageEvent.timestamp, firstDayOfMonth),
				lte(usageEvent.timestamp, now),
				inArray(usageEvent.name, [...BILLABLE_SCRIBE_USAGE_EVENT_NAMES]),
			),
		);

	let totalTokens = 0;
	let totalInputTokens = 0;
	let totalOutputTokens = 0;
	let totalCost = 0;
	const byModel: Record<string, { count: number; tokens: number; cost: number }> = {};

	for (const event of usage) {
		totalTokens += event.totalTokens ?? 0;
		totalInputTokens += event.inputTokens ?? 0;
		totalOutputTokens += event.outputTokens ?? 0;
		totalCost += Number(event.cost ?? 0);

		const model = event.model ?? "unknown";
		if (!byModel[model]) {
			byModel[model] = { cost: 0, count: 0, tokens: 0 };
		}
		byModel[model].count += 1;
		byModel[model].tokens += event.totalTokens ?? 0;
		byModel[model].cost += Number(event.cost ?? 0);
	}

	const usageCount = usage.length;

	return {
		byModel,
		count: usageCount,
		totalCost,
		totalInputTokens,
		totalOutputTokens,
		totalTokens,
	};
};

export const getUsage = async (
	session: { user: { id: string } },
	db: Database = database,
) => {
	const [usage, entitlements] = await Promise.all([
		getMonthlyScribeUsage({ db, session }),
		resolveProductEntitlements({ db, userId: session.user.id }),
	]);
	const monthlyUsagePercentage = getScribeUsageBudgetPercentage({
		monthlyCostLimit: entitlements.scribeMonthlyCostLimit,
		totalCost: usage.totalCost,
	});

	return {
		usage: {
			byModel: Object.fromEntries(
				Object.entries(usage.byModel).map(([model, value]) => [
					model,
					{ count: value.count, tokens: value.tokens },
				]),
			),
			count: usage.count,
			isMonthlyBudgetReached: usage.totalCost >= entitlements.scribeMonthlyCostLimit,
			monthlyUsagePercentage,
			totalInputTokens: usage.totalInputTokens,
			totalOutputTokens: usage.totalOutputTokens,
			totalTokens: usage.totalTokens,
		},
	};
};
