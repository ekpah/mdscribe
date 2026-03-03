import { and, eq, gte, lte, usageEvent } from "@repo/database";
import { database } from "@repo/database/client";

export const getUsage = async (
	session: { user: { id: string } },
	db: typeof database = database,
) => {
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
				acc[model] = { cost: 0, count: 0, tokens: 0 };
			}
			acc[model].count += 1;
			acc[model].tokens += event.totalTokens ?? 0;
			acc[model].cost += Number(event.cost ?? 0);
			return acc;
		},
		{} as Record<string, { count: number; tokens: number; cost: number }>,
	);

	const usageCount = usage.length;

	return {
		usage: {
			byModel,
			count: usageCount,
			totalCost,
			totalInputTokens,
			totalOutputTokens,
			totalTokens,
		},
	};
};
