import { desc, eq, usageEvent } from "@repo/database";

import { authed } from "@/orpc";

/**
 * Get recent activity (usage events) for the current user
 */
const getRecentActivityHandler = authed.handler(async ({ context }) => {
	const recentEvents = await context.db
		.select()
		.from(usageEvent)
		.where(eq(usageEvent.userId, context.session.user.id))
		.orderBy(desc(usageEvent.timestamp))
		.limit(5);

	return recentEvents;
});

export const activityHandler = {
	recentActivity: getRecentActivityHandler,
};
