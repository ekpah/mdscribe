import {
	and,
	count,
	desc,
	eq,
	gte,
	like,
	lt,
	sql,
	sum,
	usageEvent,
	user,
} from "@repo/database";
import { z } from "zod";

import { authed } from "@/orpc";
import { requiredAdminMiddleware } from "../middlewares/admin";

const listUsageEventsInput = z.object({
	cursor: z.string().optional(),
	limit: z.number().min(1).max(100).optional(),
	userId: z.string().optional(),
	name: z.string().optional(),
});

const listUsageEventsHandler = authed
	.use(requiredAdminMiddleware)
	.input(listUsageEventsInput)
	.handler(async ({ context, input }) => {
		const { cursor, userId, name } = input;
		const limit = input.limit ?? 25;

		// Build where conditions
		const conditions = [];
		if (userId) {
			conditions.push(eq(usageEvent.userId, userId));
		}
		if (name) {
			conditions.push(like(usageEvent.name, `%${name}%`));
		}

		// For cursor pagination, we need to get the cursor record first
		let cursorTimestamp: Date | null = null;
		if (cursor) {
			const [cursorRecord] = await context.db
				.select({ timestamp: usageEvent.timestamp })
				.from(usageEvent)
				.where(eq(usageEvent.id, cursor))
				.limit(1);
			cursorTimestamp = cursorRecord?.timestamp ?? null;
		}

		if (cursorTimestamp) {
			conditions.push(lt(usageEvent.timestamp, cursorTimestamp));
		}

		const whereClause =
			conditions.length > 0 ? and(...conditions) : undefined;

		const events = await context.db
			.select({
				id: usageEvent.id,
				userId: usageEvent.userId,
				timestamp: usageEvent.timestamp,
				name: usageEvent.name,
				inputTokens: usageEvent.inputTokens,
				outputTokens: usageEvent.outputTokens,
				totalTokens: usageEvent.totalTokens,
				reasoningTokens: usageEvent.reasoningTokens,
				cachedTokens: usageEvent.cachedTokens,
				cost: usageEvent.cost,
				model: usageEvent.model,
				inputData: usageEvent.inputData,
				metadata: usageEvent.metadata,
				result: usageEvent.result,
				reasoning: usageEvent.reasoning,
				user: {
					id: user.id,
					name: user.name,
					email: user.email,
				},
			})
			.from(usageEvent)
			.leftJoin(user, eq(usageEvent.userId, user.id))
			.where(whereClause)
			.orderBy(desc(usageEvent.timestamp))
			.limit(limit + 1);

		const hasMore = events.length > limit;
		const items = hasMore ? events.slice(0, -1) : events;
		const nextCursor = hasMore ? items[items.length - 1]?.id : undefined;

		return {
			items,
			nextCursor,
			hasMore,
		};
	});

const getUsageEventHandler = authed
	.use(requiredAdminMiddleware)
	.input(z.object({ id: z.string() }))
	.handler(async ({ context, input }) => {
		const [event] = await context.db
			.select({
				id: usageEvent.id,
				userId: usageEvent.userId,
				timestamp: usageEvent.timestamp,
				name: usageEvent.name,
				inputTokens: usageEvent.inputTokens,
				outputTokens: usageEvent.outputTokens,
				totalTokens: usageEvent.totalTokens,
				reasoningTokens: usageEvent.reasoningTokens,
				cachedTokens: usageEvent.cachedTokens,
				cost: usageEvent.cost,
				model: usageEvent.model,
				inputData: usageEvent.inputData,
				metadata: usageEvent.metadata,
				result: usageEvent.result,
				reasoning: usageEvent.reasoning,
				user: {
					id: user.id,
					name: user.name,
					email: user.email,
				},
			})
			.from(usageEvent)
			.leftJoin(user, eq(usageEvent.userId, user.id))
			.where(eq(usageEvent.id, input.id))
			.limit(1);

		return event ?? null;
	});

const statsFilterInput = z.object({
	filter: z.enum(["today", "week", "month", "all"]).optional(),
});

function getDateRangeStart(
	filter: "today" | "week" | "month" | "all" | undefined,
): Date | null {
	const now = new Date();

	switch (filter) {
		case "today": {
			const start = new Date(now);
			start.setHours(0, 0, 0, 0);
			return start;
		}
		case "week": {
			const start = new Date(now);
			start.setDate(start.getDate() - 7);
			start.setHours(0, 0, 0, 0);
			return start;
		}
		case "month": {
			const start = new Date(now);
			start.setDate(start.getDate() - 30);
			start.setHours(0, 0, 0, 0);
			return start;
		}
		case "all":
		default:
			return null;
	}
}

const getUsageStatsHandler = authed
	.use(requiredAdminMiddleware)
	.input(statsFilterInput)
	.handler(async ({ context, input }) => {
		const dateStart = getDateRangeStart(input.filter);

		const whereClause = dateStart
			? gte(usageEvent.timestamp, dateStart)
			: undefined;

		const [stats] = await context.db
			.select({
				totalEvents: count(),
				totalCost: sum(usageEvent.cost),
				totalTokens: sum(usageEvent.totalTokens),
			})
			.from(usageEvent)
			.where(whereClause);

		return {
			totalEvents: stats?.totalEvents ?? 0,
			totalCost: Number(stats?.totalCost) || 0,
			totalTokens: Number(stats?.totalTokens) || 0,
		};
	});

export const usageHandler = {
	list: listUsageEventsHandler,
	get: getUsageEventHandler,
	stats: getUsageStatsHandler,
};
