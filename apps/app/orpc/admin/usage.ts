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

const getUsageStatsHandler = authed
	.use(requiredAdminMiddleware)
	.handler(async ({ context }) => {
		const todayStart = new Date();
		todayStart.setHours(0, 0, 0, 0);

		const [totalEvents, totalCost, todayEvents] = await Promise.all([
			context.db.usageEvent.count(),
			context.db.usageEvent.aggregate({
				_sum: { cost: true },
			}),
			context.db.usageEvent.count({
				where: {
					timestamp: {
						gte: todayStart,
					},
				},
			}),
		]);

		return {
			totalEvents,
			totalCost: totalCost._sum.cost?.toNumber() ?? 0,
			todayEvents,
		};
	});

export const usageHandler = {
	list: listUsageEventsHandler,
	get: getUsageEventHandler,
	stats: getUsageStatsHandler,
};
