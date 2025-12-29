import { z } from 'zod';
import { authed } from '@/orpc';
import { requiredAdminMiddleware } from '../middlewares/admin';

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

		const events = await context.db.usageEvent.findMany({
			take: limit + 1,
			...(cursor && {
				cursor: { id: cursor },
				skip: 1,
			}),
			where: {
				...(userId && { userId }),
				...(name && { name: { contains: name } }),
			},
			orderBy: { timestamp: 'desc' },
			include: {
				user: {
					select: {
						id: true,
						name: true,
						email: true,
					},
				},
			},
		});

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
		const event = await context.db.usageEvent.findUnique({
			where: { id: input.id },
			include: {
				user: {
					select: {
						id: true,
						name: true,
						email: true,
					},
				},
			},
		});
		return event;
	});

const statsFilterInput = z.object({
	filter: z.enum(['today', 'week', 'month', 'all']).optional(),
});

function getDateRangeStart(filter: 'today' | 'week' | 'month' | 'all' | undefined): Date | null {
	const now = new Date();

	switch (filter) {
		case 'today': {
			const start = new Date(now);
			start.setHours(0, 0, 0, 0);
			return start;
		}
		case 'week': {
			const start = new Date(now);
			start.setDate(start.getDate() - 7);
			start.setHours(0, 0, 0, 0);
			return start;
		}
		case 'month': {
			const start = new Date(now);
			start.setDate(start.getDate() - 30);
			start.setHours(0, 0, 0, 0);
			return start;
		}
		case 'all':
		default:
			return null;
	}
}

const getUsageStatsHandler = authed
	.use(requiredAdminMiddleware)
	.input(statsFilterInput)
	.handler(async ({ context, input }) => {
		const dateStart = getDateRangeStart(input.filter);

		const whereClause = dateStart ? { timestamp: { gte: dateStart } } : {};

		const [totalEvents, totalCost, totalTokens] = await Promise.all([
			context.db.usageEvent.count({ where: whereClause }),
			context.db.usageEvent.aggregate({
				_sum: { cost: true },
				where: whereClause,
			}),
			context.db.usageEvent.aggregate({
				_sum: { totalTokens: true },
				where: whereClause,
			}),
		]);

		return {
			totalEvents,
			totalCost: totalCost._sum.cost?.toNumber() ?? 0,
			totalTokens: totalTokens._sum.totalTokens ?? 0,
		};
	});

export const usageHandler = {
	list: listUsageEventsHandler,
	get: getUsageEventHandler,
	stats: getUsageStatsHandler,
};
