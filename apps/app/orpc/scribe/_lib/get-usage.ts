import { aiProvider, and, eq, gte, lte, usageEvent, userAiProvider } from "@repo/database";
import type { Database } from "@repo/database";
import { database } from "@repo/database/client";

import { resolveProductEntitlements } from "@/lib/product-entitlements";
import { getScribeUsageBudgetPercentage } from "@/lib/product-plans";
import { isByokUsageMetadata } from "@/lib/usage-logging";
import { resolveMonthlyUsagePeriod } from "@/lib/usage-period";
import type { MonthlyUsagePeriod } from "@/lib/usage-period";

export const getMonthlyScribeUsage = async (input: {
	db?: Database;
	now?: Date;
	period?: MonthlyUsagePeriod;
	session: { user: { id: string } };
}) => {
	const db = input.db ?? database;
	const now = input.now ?? new Date();
	const period =
		input.period ??
		resolveMonthlyUsagePeriod({
			hasActiveSubscription: false,
			now,
		});

	const usage = await db
		.select({
			cost: usageEvent.cost,
			inputTokens: usageEvent.inputTokens,
			metadata: usageEvent.metadata,
			model: usageEvent.model,
			outputTokens: usageEvent.outputTokens,
			totalTokens: usageEvent.totalTokens,
		})
		.from(usageEvent)
		.where(
			and(
				eq(usageEvent.userId, input.session.user.id),
				gte(usageEvent.timestamp, period.start),
				lte(usageEvent.timestamp, now),
			),
		);

	let totalTokens = 0;
	let totalInputTokens = 0;
	let totalOutputTokens = 0;
	let totalCost = 0;
	const byModel: Record<string, { count: number; tokens: number; cost: number }> = {};

	for (const event of usage) {
		const isUserByok = isByokUsageMetadata(event.metadata);
		totalTokens += event.totalTokens ?? 0;
		totalInputTokens += event.inputTokens ?? 0;
		totalOutputTokens += event.outputTokens ?? 0;
		if (!isUserByok) {
			totalCost += Number(event.cost ?? 0);
		}

		const model = event.model ?? "unknown";
		if (!byModel[model]) {
			byModel[model] = { cost: 0, count: 0, tokens: 0 };
		}
		byModel[model].count += 1;
		byModel[model].tokens += event.totalTokens ?? 0;
		if (!isUserByok) {
			byModel[model].cost += Number(event.cost ?? 0);
		}
	}

	const usageCount = usage.length;

	return {
		byModel,
		count: usageCount,
		period,
		totalCost,
		totalInputTokens,
		totalOutputTokens,
		totalTokens,
	};
};

export const getUsage = async (
	session: { user: { id: string } },
	db: Database = database,
	now: Date = new Date(),
) => {
	const entitlements = await resolveProductEntitlements({ db, userId: session.user.id });
	const period = resolveMonthlyUsagePeriod({
		hasActiveSubscription: entitlements.hasActiveSubscription,
		now,
		subscriptionPeriodEnd: entitlements.subscriptionPeriodEnd,
		subscriptionPeriodStart: entitlements.subscriptionPeriodStart,
	});
	const [usage, activeByokConnections] = await Promise.all([
		getMonthlyScribeUsage({ db, now, period, session }),
		db
			.select({ id: userAiProvider.id })
			.from(userAiProvider)
			.innerJoin(aiProvider, eq(aiProvider.id, userAiProvider.providerId))
			.where(
				and(
					eq(userAiProvider.userId, session.user.id),
					eq(userAiProvider.enabled, true),
					eq(aiProvider.byokEnabled, true),
				),
			)
			.limit(1),
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
			hasActiveByokConnection: activeByokConnections.length > 0,
			isMonthlyBudgetReached: usage.totalCost >= entitlements.scribeMonthlyCostLimit,
			monthlyUsagePercentage,
			periodStartsAt: usage.period.start.toISOString(),
			periodType: usage.period.type,
			resetsAt: usage.period.end.toISOString(),
			totalInputTokens: usage.totalInputTokens,
			totalOutputTokens: usage.totalOutputTokens,
			totalTokens: usage.totalTokens,
		},
	};
};
