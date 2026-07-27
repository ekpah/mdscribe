import { aiScribeFormConfig, and, desc, eq, gte, inArray, sql, usageEvent } from "@repo/database";

import {
	DASHBOARD_AI_FUNCTION_ENDPOINTS,
	selectDashboardAiFunctions,
} from "@/lib/dashboard-ai-functions";
import { AI_SCRIBE_GENERATION_EVENT_NAME } from "@/lib/usage-event-names";
import { authed } from "@/orpc";

const getCustomFormId = (metadata: unknown): string | null => {
	if (typeof metadata !== "object" || metadata === null) {
		return null;
	}

	const { customFormId } = metadata as Record<string, unknown>;
	return typeof customFormId === "string" ? customFormId : null;
};

/**
 * Get recent activity (usage events) for the current user
 */
const getRecentActivityHandler = authed.handler(async ({ context }) => {
	const recentEvents = await context.db
		.select({
			id: usageEvent.id,
			metadata: usageEvent.metadata,
			name: usageEvent.name,
			timestamp: usageEvent.timestamp,
		})
		.from(usageEvent)
		.where(eq(usageEvent.userId, context.session.user.id))
		.orderBy(desc(usageEvent.timestamp))
		.limit(5);

	const customFormIds = [
		...new Set(
			recentEvents
				.map((event) => getCustomFormId(event.metadata))
				.filter((id): id is string => id !== null),
		),
	];
	const customForms =
		customFormIds.length > 0
			? await context.db
					.select({
						id: aiScribeFormConfig.id,
						name: aiScribeFormConfig.name,
					})
					.from(aiScribeFormConfig)
					.where(inArray(aiScribeFormConfig.id, customFormIds))
			: [];
	const customFormNames = new Map(customForms.map((form) => [form.id, form.name]));

	return recentEvents.map((event) => ({
		...event,
		customFormName: customFormNames.get(getCustomFormId(event.metadata) ?? "") ?? null,
	}));
});

const endpointExpression = sql<string>`${usageEvent.metadata} ->> 'endpoint'`;

const getAiFunctionRecommendationsHandler = authed.handler(async ({ context }) => {
	const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
	const sharedConditions = and(
		eq(usageEvent.name, AI_SCRIBE_GENERATION_EVENT_NAME),
		gte(usageEvent.timestamp, thirtyDaysAgo),
		inArray(endpointExpression, DASHBOARD_AI_FUNCTION_ENDPOINTS),
	);
	const selectUsage = () => ({
		count: sql<number>`count(*)::int`.as("usageCount"),
		endpoint: endpointExpression.as("endpoint"),
	});

	const [userUsage, globalUsage] = await Promise.all([
		context.db
			.select(selectUsage())
			.from(usageEvent)
			.where(and(sharedConditions, eq(usageEvent.userId, context.session.user.id)))
			.groupBy(endpointExpression),
		context.db
			.select(selectUsage())
			.from(usageEvent)
			.where(sharedConditions)
			.groupBy(endpointExpression),
	]);

	return selectDashboardAiFunctions({ globalUsage, userUsage });
});

export const activityHandler = {
	aiFunctionRecommendations: getAiFunctionRecommendationsHandler,
	recentActivity: getRecentActivityHandler,
};
