import { ORPCError } from "@orpc/server";
import {
	and,
	aiScribeFormConfig,
	avg,
	count,
	desc,
	eq,
	like,
	lt,
	sql,
	sum,
	usageEvent,
	user,
} from "@repo/database";
import type { Database } from "@repo/database";
import { generateObject } from "ai";
import { z } from "zod";

import { USER_MESSAGES } from "@/lib/user-messages";
import { authed } from "@/orpc";
import { requiredAdminMiddleware } from "@/orpc/middlewares/admin";
import { PLAYGROUND_EVALUATION_SYSTEM_PROMPT } from "@/orpc/scribe/prompts/core/evaluation";
import { buildProviderOptions, resolveDefaultModel } from "@/orpc/scribe/providers";

const usageEvaluationSchema = z.object({
	categories: z
		.array(
			z.object({
				comment: z.string(),
				name: z.string(),
				score: z.number().min(0).max(10),
			}),
		)
		.length(4),
	summary: z.string(),
});

const toMetadataRecord = (metadata: unknown): Record<string, unknown> => {
	if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
		return {};
	}
	return metadata as Record<string, unknown>;
};

const getCustomFormSlugFromMetadata = (metadata: Record<string, unknown>): string | null => {
	const { endpoint } = metadata;
	if (typeof endpoint !== "string" || !endpoint.startsWith("custom:")) {
		return null;
	}

	const slug = endpoint.slice("custom:".length).trim();
	return slug.length > 0 ? slug : null;
};

const enrichCustomFormUsageMetadata = async (
	db: { query: Database["query"] },
	metadata: unknown,
): Promise<Record<string, unknown> | null> => {
	const metadataRecord = toMetadataRecord(metadata);
	const slug = getCustomFormSlugFromMetadata(metadataRecord);
	if (!slug) {
		return Object.keys(metadataRecord).length > 0 ? metadataRecord : null;
	}

	const form = await db.query.aiScribeFormConfig.findFirst({
		columns: {
			id: true,
			promptHarness: true,
			slug: true,
			templateId: true,
		},
		where: eq(aiScribeFormConfig.slug, slug),
	});

	if (!form) {
		return metadataRecord;
	}

	return {
		...metadataRecord,
		customFormId: metadataRecord.customFormId ?? form.id,
		customFormSlug: metadataRecord.customFormSlug ?? form.slug,
		promptName: metadataRecord.promptName ?? form.promptHarness,
		templateId: metadataRecord.templateId ?? form.templateId,
	};
};

const getDocumentTypeForEvaluation = (
	eventName: string,
	metadata: Record<string, unknown>,
): string => {
	const { endpoint } = metadata;
	if (typeof endpoint === "string" && endpoint.trim().length > 0) {
		return endpoint;
	}

	const { promptName } = metadata;
	if (typeof promptName === "string" && promptName.trim().length > 0) {
		return promptName;
	}

	return eventName;
};

const listUsageEventsInput = z.object({
	cursor: z.string().optional(),
	limit: z.number().min(1).max(100).optional(),
	name: z.string().optional(),
	userId: z.string().optional(),
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

		const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

		const events = await context.db
			.select({
				cost: usageEvent.cost,
				id: usageEvent.id,
				metadata: usageEvent.metadata,
				model: usageEvent.model,
				name: usageEvent.name,
				outputTokens: usageEvent.outputTokens,
				timeToCompletionMs: usageEvent.timeToCompletionMs,
				timeToFirstTokenMs: usageEvent.timeToFirstTokenMs,
				timestamp: usageEvent.timestamp,
				totalTokens: usageEvent.totalTokens,
				user: {
					email: user.email,
					id: user.id,
					name: user.name,
				},
			})
			.from(usageEvent)
			.leftJoin(user, eq(usageEvent.userId, user.id))
			.where(whereClause)
			.orderBy(desc(usageEvent.timestamp))
			.limit(limit + 1);

		const hasMore = events.length > limit;
		const items = hasMore ? events.slice(0, -1) : events;
		const nextCursor = hasMore ? items.at(-1)?.id : undefined;

		return {
			hasMore,
			items,
			nextCursor,
		};
	});

const getUsageEventHandler = authed
	.use(requiredAdminMiddleware)
	.input(z.object({ id: z.string() }))
	.handler(async ({ context, input }) => {
		const [event] = await context.db
			.select({
				cachedTokens: usageEvent.cachedTokens,
				cost: usageEvent.cost,
				id: usageEvent.id,
				inputData: usageEvent.inputData,
				inputTokens: usageEvent.inputTokens,
				metadata: usageEvent.metadata,
				model: usageEvent.model,
				name: usageEvent.name,
				outputTokens: usageEvent.outputTokens,
				reasoning: usageEvent.reasoning,
				reasoningTokens: usageEvent.reasoningTokens,
				result: usageEvent.result,
				timeToCompletionMs: usageEvent.timeToCompletionMs,
				timeToFirstTokenMs: usageEvent.timeToFirstTokenMs,
				timestamp: usageEvent.timestamp,
				totalTokens: usageEvent.totalTokens,
				user: {
					email: user.email,
					id: user.id,
					name: user.name,
				},
				userId: usageEvent.userId,
			})
			.from(usageEvent)
			.leftJoin(user, eq(usageEvent.userId, user.id))
			.where(eq(usageEvent.id, input.id))
			.limit(1);

		if (!event) {
			return null;
		}

		return {
			...event,
			metadata: await enrichCustomFormUsageMetadata(context.db, event.metadata),
		};
	});

const findByRequestIdHandler = authed
	.use(requiredAdminMiddleware)
	.input(z.object({ requestId: z.string() }))
	.handler(async ({ context, input }) => {
		const [event] = await context.db
			.select({
				cachedTokens: usageEvent.cachedTokens,
				cost: usageEvent.cost,
				id: usageEvent.id,
				inputData: usageEvent.inputData,
				inputTokens: usageEvent.inputTokens,
				metadata: usageEvent.metadata,
				model: usageEvent.model,
				name: usageEvent.name,
				outputTokens: usageEvent.outputTokens,
				reasoning: usageEvent.reasoning,
				reasoningTokens: usageEvent.reasoningTokens,
				result: usageEvent.result,
				timeToCompletionMs: usageEvent.timeToCompletionMs,
				timeToFirstTokenMs: usageEvent.timeToFirstTokenMs,
				timestamp: usageEvent.timestamp,
				totalTokens: usageEvent.totalTokens,
				user: {
					email: user.email,
					id: user.id,
					name: user.name,
				},
				userId: usageEvent.userId,
			})
			.from(usageEvent)
			.leftJoin(user, eq(usageEvent.userId, user.id))
			.where(sql`${usageEvent.metadata} ->> 'requestId' = ${input.requestId}`)
			.orderBy(desc(usageEvent.timestamp))
			.limit(1);

		if (!event) {
			return null;
		}

		return {
			...event,
			metadata: await enrichCustomFormUsageMetadata(context.db, event.metadata),
		};
	});

const evaluateUsageEventHandler = authed
	.use(requiredAdminMiddleware)
	.input(z.object({ id: z.string() }))
	.handler(async ({ context, input }) => {
		const event = await context.db.query.usageEvent.findFirst({
			where: eq(usageEvent.id, input.id),
		});

		if (!event) {
			throw new ORPCError("NOT_FOUND", { message: "Event not found" });
		}

		if (!event.result?.trim()) {
			throw new ORPCError("BAD_REQUEST", {
				message: "Dieses Event enthält kein bewertbares Ergebnis.",
			});
		}

		const evaluationSelection = await resolveDefaultModel(context.db, "evaluation").catch(
			(error: unknown) => {
				const details = error instanceof Error ? error.message : USER_MESSAGES.modelUnavailable;
				throw new ORPCError("BAD_REQUEST", {
					message: `Kein Standard-Evaluationsmodell konfiguriert. (${details})`,
				});
			},
		);
		const metadata = toMetadataRecord(event.metadata);
		const documentType = getDocumentTypeForEvaluation(event.name, metadata);

		let evaluation;
		try {
			evaluation = await generateObject({
				model: evaluationSelection.model.model,
				prompt: `Bewerte ausschliesslich die Modell-Ausgabe.

Dokumenttyp: ${documentType}

Nutzergegebene Eingaben, Prompt-Spezifika und ggf. Vorlage:
${JSON.stringify(event.inputData ?? {}, null, 2)}

Modell-Ausgabe:
${event.result}`,
				providerOptions: buildProviderOptions({
					model: evaluationSelection.model,
					reasoningEffort: evaluationSelection.reasoningEffort,
					userId: context.session.user.id,
				}),
				schema: usageEvaluationSchema,
				system: PLAYGROUND_EVALUATION_SYSTEM_PROMPT,
				temperature: 0.1,
			});
		} catch (error) {
			if (error instanceof Error && error.name === "AI_NoObjectGeneratedError") {
				throw new ORPCError("BAD_REQUEST", {
					message: `Bewertung konnte nicht erzeugt werden: Das Modell hat keine gültige Struktur zurückgegeben. ${error.message}`,
				});
			}
			const details = error instanceof Error ? error.message : USER_MESSAGES.evaluationFailed;
			throw new ORPCError("INTERNAL", {
				message: `Bewertung fehlgeschlagen: ${details}`,
			});
		}

		const categories = evaluation.object.categories.map((category) => ({
			comment: category.comment,
			name: category.name,
			score: Number(category.score.toFixed(1)),
		}));
		const totalScore = Number(
			(
				categories.reduce((total, category) => total + category.score, 0) /
				Math.max(1, categories.length)
			).toFixed(1),
		);
		const usageEvaluation = {
			categories,
			evaluatedAt: new Date().toISOString(),
			summary: evaluation.object.summary,
			totalScore,
		};
		const nextMetadata = {
			...metadata,
			usageEvaluation,
		};

		await context.db
			.update(usageEvent)
			.set({ metadata: nextMetadata })
			.where(eq(usageEvent.id, event.id));

		return usageEvaluation;
	});

const statsFilterInput = z.object({
	filter: z.enum(["today", "week", "month", "all"]).optional(),
	timeZone: z.string().trim().min(1).max(100).optional(),
});

type StatsFilter = NonNullable<z.infer<typeof statsFilterInput>["filter"]>;
type TrendGranularity = "day" | "hour";

const DEFAULT_USAGE_STATS_TIME_ZONE = "UTC";

const getTrendGranularity = (filter: StatsFilter): TrendGranularity =>
	filter === "today" ? "hour" : "day";

const resolveStatsTimeZone = (timeZone: string | undefined): string => {
	if (!timeZone) {
		return DEFAULT_USAGE_STATS_TIME_ZONE;
	}

	try {
		new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
		return timeZone;
	} catch {
		return DEFAULT_USAGE_STATS_TIME_ZONE;
	}
};

// Postgres treats repeated bind parameters as different expressions in GROUP BY,
// so the validated IANA timezone is embedded as a quoted literal.
const toSqlStringLiteral = (value: string): ReturnType<typeof sql.raw> =>
	sql.raw(`'${value.replaceAll("'", "''")}'`);

const getLocalRangeStartExpression = (
	filter: StatsFilter,
	timeZoneLiteral: ReturnType<typeof sql.raw>,
): ReturnType<typeof sql> | null => {
	const localToday = sql`date_trunc('day', timezone(${timeZoneLiteral}, now()))`;

	switch (filter) {
		case "today": {
			return localToday;
		}
		case "week": {
			return sql`(${localToday} - interval '7 days')`;
		}
		case "month": {
			return sql`(${localToday} - interval '30 days')`;
		}
		case "all": {
			return null;
		}
		default: {
			return null;
		}
	}
};

const toFiniteMetric = (value: unknown): number | null => {
	if (value === null || value === undefined) {
		return null;
	}
	const numericValue = Number(value);
	return Number.isFinite(numericValue) ? numericValue : null;
};

const toRoundedMetric = (value: unknown, fractionDigits = 0): number | null => {
	const numericValue = toFiniteMetric(value);
	if (numericValue === null) {
		return null;
	}
	return Number(numericValue.toFixed(fractionDigits));
};

const buildPercentileStats = (p50: unknown, p90: unknown, p95: unknown, fractionDigits = 0) => ({
	p50: toRoundedMetric(p50, fractionDigits),
	p90: toRoundedMetric(p90, fractionDigits),
	p95: toRoundedMetric(p95, fractionDigits),
});

const emptyPercentileStats = {
	p50: null,
	p90: null,
	p95: null,
};

interface UsageTrendRow {
	bucket: unknown;
	cost: unknown;
	events: unknown;
	timeToCompletionP50: unknown;
	timeToCompletionP90: unknown;
	timeToCompletionP95: unknown;
	timeToFirstTokenP50: unknown;
	timeToFirstTokenP90: unknown;
	timeToFirstTokenP95: unknown;
	tokens: unknown;
	tokensPerSecondP50: unknown;
	tokensPerSecondP90: unknown;
	tokensPerSecondP95: unknown;
}

const buildTrendBucket = (bucket: string, row: UsageTrendRow | undefined) => ({
	bucket,
	cost: Number(row?.cost) || 0,
	events: Number(row?.events) || 0,
	timeToCompletionMs: row
		? buildPercentileStats(
				row.timeToCompletionP50,
				row.timeToCompletionP90,
				row.timeToCompletionP95,
			)
		: emptyPercentileStats,
	timeToFirstTokenMs: row
		? buildPercentileStats(
				row.timeToFirstTokenP50,
				row.timeToFirstTokenP90,
				row.timeToFirstTokenP95,
			)
		: emptyPercentileStats,
	tokens: Number(row?.tokens) || 0,
	tokensPerSecond: row
		? buildPercentileStats(
				row.tokensPerSecondP50,
				row.tokensPerSecondP90,
				row.tokensPerSecondP95,
				1,
			)
		: emptyPercentileStats,
});

const buildUsageTrend = (seriesRows: { bucket: string }[], trendRows: UsageTrendRow[]) => {
	const rowByBucket = new Map(trendRows.map((row) => [String(row.bucket), row]));
	return seriesRows.map((seriesRow) => {
		const bucket = String(seriesRow.bucket);
		return buildTrendBucket(bucket, rowByBucket.get(bucket));
	});
};

const calculateTokensPerSecond = (
	timedTotalTokens: number,
	timedTotalCompletionMs: number,
): number | null => {
	if (timedTotalCompletionMs > 0) {
		return Number((timedTotalTokens / (timedTotalCompletionMs / 1000)).toFixed(1));
	}
	return null;
};

const buildUsageStatsExpressions = (filter: StatsFilter, timeZone: string) => {
	const timeZoneLiteral = toSqlStringLiteral(timeZone);
	const trendGranularity = getTrendGranularity(filter);
	const localRangeStartExpression = getLocalRangeStartExpression(filter, timeZoneLiteral);
	const localTimestampExpression = sql`timezone(${timeZoneLiteral}, ${usageEvent.timestamp})`;
	const bucketExpression =
		trendGranularity === "hour"
			? sql<Date>`date_trunc('hour', ${localTimestampExpression})`
			: sql<Date>`date_trunc('day', ${localTimestampExpression})`;
	const localNowBucketExpression =
		trendGranularity === "hour"
			? sql`date_trunc('hour', timezone(${timeZoneLiteral}, now()))`
			: sql`date_trunc('day', timezone(${timeZoneLiteral}, now()))`;
	const seriesStartExpression =
		localRangeStartExpression ||
		sql`coalesce(
				(select min(${bucketExpression}) from ${usageEvent}),
				${localNowBucketExpression}
			)`;
	const seriesStepExpression =
		trendGranularity === "hour" ? sql`interval '1 hour'` : sql`interval '1 day'`;

	const whereClause = localRangeStartExpression
		? sql`${usageEvent.timestamp} >= (${localRangeStartExpression} at time zone ${timeZoneLiteral})`
		: undefined;

	return {
		bucketExpression,
		localNowBucketExpression,
		seriesStartExpression,
		seriesStepExpression,
		timeZoneLiteral,
		trendGranularity,
		whereClause,
	};
};

const getUsageStatsHandler = authed
	.use(requiredAdminMiddleware)
	.input(statsFilterInput)
	.handler(async ({ context, input }) => {
		const filter = input.filter ?? "all";
		const timeZone = resolveStatsTimeZone(input.timeZone);
		const {
			bucketExpression,
			localNowBucketExpression,
			seriesStartExpression,
			seriesStepExpression,
			trendGranularity,
			whereClause,
		} = buildUsageStatsExpressions(filter, timeZone);

		const [statsRows, trendRows, seriesRows] = await Promise.all([
			context.db
				.select({
					activeUsers: sql<number>`count(distinct ${usageEvent.userId})`,
					averageTimeToCompletionMs: avg(usageEvent.timeToCompletionMs),
					averageTimeToFirstTokenMs: avg(usageEvent.timeToFirstTokenMs),
					timedTotalCompletionMs: sql<number>`
						coalesce(
							sum(
								case
									when ${usageEvent.timeToCompletionMs} is not null
										and ${usageEvent.timeToCompletionMs} > 0
									then ${usageEvent.timeToCompletionMs}
									else 0
								end
							),
							0
						)
					`,
					timedTotalTokens: sql<number>`
						coalesce(
							sum(
								case
									when ${usageEvent.timeToCompletionMs} is not null
										and ${usageEvent.timeToCompletionMs} > 0
									then coalesce(${usageEvent.outputTokens}, 0)
									else 0
								end
							),
							0
						)
					`,
					totalCost: sum(usageEvent.cost),
					totalEvents: count(),
					totalTokens: sum(usageEvent.totalTokens),
				})
				.from(usageEvent)
				.where(whereClause),
			context.db
				.select({
					bucket: sql<string>`to_char(${bucketExpression}, 'YYYY-MM-DD"T"HH24:MI:SS')`,
					cost: sql<number>`coalesce(sum(${usageEvent.cost}), 0)`,
					events: count(),
					timeToCompletionP50: sql<number | null>`
						percentile_cont(0.5)
						within group (order by ${usageEvent.timeToCompletionMs})
						filter (where ${usageEvent.timeToCompletionMs} is not null)
					`,
					timeToCompletionP90: sql<number | null>`
						percentile_cont(0.9)
						within group (order by ${usageEvent.timeToCompletionMs})
						filter (where ${usageEvent.timeToCompletionMs} is not null)
					`,
					timeToCompletionP95: sql<number | null>`
						percentile_cont(0.95)
						within group (order by ${usageEvent.timeToCompletionMs})
						filter (where ${usageEvent.timeToCompletionMs} is not null)
					`,
					timeToFirstTokenP50: sql<number | null>`
						percentile_cont(0.5)
						within group (order by ${usageEvent.timeToFirstTokenMs})
						filter (where ${usageEvent.timeToFirstTokenMs} is not null)
					`,
					timeToFirstTokenP90: sql<number | null>`
						percentile_cont(0.9)
						within group (order by ${usageEvent.timeToFirstTokenMs})
						filter (where ${usageEvent.timeToFirstTokenMs} is not null)
					`,
					timeToFirstTokenP95: sql<number | null>`
						percentile_cont(0.95)
						within group (order by ${usageEvent.timeToFirstTokenMs})
						filter (where ${usageEvent.timeToFirstTokenMs} is not null)
					`,
					tokens: sql<number>`coalesce(sum(${usageEvent.totalTokens}), 0)`,
					tokensPerSecondP50: sql<number | null>`
						percentile_cont(0.5)
						within group (
							order by (
								${usageEvent.outputTokens}::double precision /
								(${usageEvent.timeToCompletionMs}::double precision / 1000)
							)
						)
						filter (
							where ${usageEvent.outputTokens} is not null
								and ${usageEvent.timeToCompletionMs} is not null
								and ${usageEvent.timeToCompletionMs} > 0
						)
					`,
					tokensPerSecondP90: sql<number | null>`
						percentile_cont(0.9)
						within group (
							order by (
								${usageEvent.outputTokens}::double precision /
								(${usageEvent.timeToCompletionMs}::double precision / 1000)
							)
						)
						filter (
							where ${usageEvent.outputTokens} is not null
								and ${usageEvent.timeToCompletionMs} is not null
								and ${usageEvent.timeToCompletionMs} > 0
						)
					`,
					tokensPerSecondP95: sql<number | null>`
						percentile_cont(0.95)
						within group (
							order by (
								${usageEvent.outputTokens}::double precision /
								(${usageEvent.timeToCompletionMs}::double precision / 1000)
							)
						)
						filter (
							where ${usageEvent.outputTokens} is not null
								and ${usageEvent.timeToCompletionMs} is not null
								and ${usageEvent.timeToCompletionMs} > 0
						)
					`,
				})
				.from(usageEvent)
				.where(whereClause)
				.groupBy(bucketExpression)
				.orderBy(bucketExpression),
			context.db.execute(
				sql<{ bucket: string }>`
					select to_char(series.bucket, 'YYYY-MM-DD"T"HH24:MI:SS') as bucket
					from generate_series(
						${seriesStartExpression},
						${localNowBucketExpression},
						${seriesStepExpression}
					) as series(bucket)
				`,
			),
		]);

		const [stats] = statsRows;
		const averageTimeToCompletionMs = toFiniteMetric(stats?.averageTimeToCompletionMs);
		const averageTimeToFirstTokenMs = toFiniteMetric(stats?.averageTimeToFirstTokenMs);
		const timedTotalCompletionMs = Number(stats?.timedTotalCompletionMs) || 0;
		const timedTotalTokens = Number(stats?.timedTotalTokens) || 0;
		const trend = buildUsageTrend(
			seriesRows.map((row) => ({ bucket: String(row.bucket) })),
			trendRows,
		);

		return {
			activeUsers: Number(stats?.activeUsers) || 0,
			averageTimeToCompletionMs:
				averageTimeToCompletionMs === null ? null : Math.round(averageTimeToCompletionMs),
			averageTimeToFirstTokenMs:
				averageTimeToFirstTokenMs === null ? null : Math.round(averageTimeToFirstTokenMs),
			timeZone,
			tokensPerSecond: calculateTokensPerSecond(timedTotalTokens, timedTotalCompletionMs),
			totalCost: Number(stats?.totalCost) || 0,
			totalEvents: stats?.totalEvents ?? 0,
			totalTokens: Number(stats?.totalTokens) || 0,
			trend,
			trendGranularity,
		};
	});

export const usageHandler = {
	evaluate: evaluateUsageEventHandler,
	findByRequestId: findByRequestIdHandler,
	get: getUsageEventHandler,
	list: listUsageEventsHandler,
	stats: getUsageStatsHandler,
};
