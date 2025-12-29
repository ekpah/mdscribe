import { database } from "@repo/database";
import type { Session } from "@/lib/auth-types";

export async function getUsage(session: Session) {
	const now = new Date();
	const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

	const usage = await database.usageEvent.findMany({
		where: {
			userId: session.user.id,
			timestamp: {
				gte: firstDayOfMonth,
				lte: now,
			},
			name: "ai_scribe_generation",
		},
		select: {
			totalTokens: true,
			inputTokens: true,
			outputTokens: true,
			cost: true,
			model: true,
		},
	});

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

	return {
		usage: {
			count: usageCount,
			totalTokens,
			totalInputTokens,
			totalOutputTokens,
			totalCost,
			byModel,
		},
	};
}
