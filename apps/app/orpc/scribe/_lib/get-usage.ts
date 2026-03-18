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
