import { ORPCError } from "@orpc/server";
import {
	and,
	asc,
	aiScribeFormConfig,
	avg,
	desc,
	eq,
	inArray,
	like,
	lt,
	gte,
	sql,
	sum,
	usageEvent,
	usageObservation,
	usageTrace,
	user,
} from "@repo/database";
import type { Database } from "@repo/database";
import { generateObject } from "ai";
import { z } from "zod";

import { USER_MESSAGES } from "@/lib/user-messages";
import { authed } from "@/orpc";
import { requiredAdminMiddleware } from "@/orpc/middlewares/admin";
import { resolvePromptHarnessId } from "@/orpc/scribe/prompts";
import { USAGE_EVENT_EVALUATION_SYSTEM_PROMPT } from "@/orpc/scribe/prompts/core/evaluation";
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
		return resolvePromptHarnessId(promptName) ?? promptName;
	}

	return eventName;
};

type StatsFilter = "today" | "week" | "month" | "all";
type TrendGranularity = "day" | "hour";

const DEFAULT_USAGE_STATS_TIME_ZONE = "UTC";

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

const usageFiltersInput = z.object({
	action: z.string().trim().min(1).optional(),
	cursor: z.string().optional(),
	filter: z.enum(["today", "week", "month", "all"]).optional(),
	limit: z.number().min(1).max(100).optional(),
	model: z.string().trim().min(1).optional(),
	name: z.string().optional(),
	prompt: z.string().trim().min(1).optional(),
	timeZone: z.string().trim().min(1).max(100).optional(),
	userId: z.string().optional(),
});

const listUsageEventsInput = usageFiltersInput;

const getUsagePromptExpression = () =>
	sql<string>`coalesce(${usageEvent.metadata} ->> 'endpoint', ${usageEvent.metadata} ->> 'promptLabel', ${usageEvent.metadata} ->> 'promptName')`;

interface UsageFilterValues {
	action?: string;
	filter?: StatsFilter;
	model?: string;
	name?: string;
	prompt?: string;
	timeZone?: string;
	userId?: string;
}

const buildUsageFilterConditions = (input: UsageFilterValues) => {
	const conditions = [];
	if (input.userId) {
		conditions.push(eq(usageEvent.userId, input.userId));
	}
	if (input.name) {
		conditions.push(like(usageEvent.name, `%${input.name}%`));
	}
	if (input.action) {
		conditions.push(eq(usageEvent.name, input.action));
	}
	if (input.model) {
		conditions.push(eq(usageEvent.model, input.model));
	}
	if (input.prompt) {
		conditions.push(eq(getUsagePromptExpression(), input.prompt));
	}

	const timeZone = resolveStatsTimeZone(input.timeZone);
	const rangeStart = getLocalRangeStartExpression(
		input.filter ?? "all",
		toSqlStringLiteral(timeZone),
	);
	if (rangeStart) {
		conditions.push(
			gte(usageEvent.timestamp, sql`(${rangeStart} at time zone ${toSqlStringLiteral(timeZone)})`),
		);
	}

	return conditions;
};

const listUsageEventsHandler = authed
	.use(requiredAdminMiddleware)
	.input(listUsageEventsInput)
	.handler(async ({ context, input }) => {
		const { cursor } = input;
		const limit = input.limit ?? 25;

		// Build where conditions
		const conditions = buildUsageFilterConditions(input);

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
				inputTokens: usageEvent.inputTokens,
				metadata: usageEvent.metadata,
				model: usageEvent.model,
				name: usageEvent.name,
				outputTokens: usageEvent.outputTokens,
				reasoningTokens: usageEvent.reasoningTokens,
				timeToCompletionMs: usageEvent.timeToCompletionMs,
				timeToFirstTokenMs: usageEvent.timeToFirstTokenMs,
				timestamp: usageEvent.timestamp,
				totalTokens: usageEvent.totalTokens,
				traceId: usageEvent.traceId,
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
		const traceIds = [...new Set(items.flatMap((event) => (event.traceId ? [event.traceId] : [])))];
		const traces =
			traceIds.length === 0
				? []
				: await context.db.query.usageTrace.findMany({
						orderBy: [desc(usageTrace.startedAt)],
						where: inArray(usageTrace.id, traceIds),
						with: { observations: { orderBy: [asc(usageObservation.sequence)] } },
					});
		const traceEvents =
			traceIds.length === 0
				? []
				: await context.db
						.select({
							cost: usageEvent.cost,
							id: usageEvent.id,
							inputTokens: usageEvent.inputTokens,
							metadata: usageEvent.metadata,
							model: usageEvent.model,
							name: usageEvent.name,
							outputTokens: usageEvent.outputTokens,
							reasoningTokens: usageEvent.reasoningTokens,
							timeToCompletionMs: usageEvent.timeToCompletionMs,
							timeToFirstTokenMs: usageEvent.timeToFirstTokenMs,
							timestamp: usageEvent.timestamp,
							totalTokens: usageEvent.totalTokens,
							traceId: usageEvent.traceId,
							user: { email: user.email, id: user.id, name: user.name },
						})
						.from(usageEvent)
						.leftJoin(user, eq(usageEvent.userId, user.id))
						.where(inArray(usageEvent.traceId, traceIds))
						.orderBy(asc(usageEvent.timestamp));

		return {
			hasMore,
			items,
			nextCursor,
			traceEvents,
			traces,
		};
	});

const usageFilterOptionsHandler = authed
	.use(requiredAdminMiddleware)
	.handler(async ({ context }) => {
		const promptExpression = getUsagePromptExpression();
		const [actions, models, prompts] = await Promise.all([
			context.db
				.select({ value: usageEvent.name })
				.from(usageEvent)
				.groupBy(usageEvent.name)
				.orderBy(asc(usageEvent.name)),
			context.db
				.select({ value: usageEvent.model })
				.from(usageEvent)
				.where(sql`${usageEvent.model} is not null`)
				.groupBy(usageEvent.model)
				.orderBy(asc(usageEvent.model)),
			context.db
				.select({ value: promptExpression })
				.from(usageEvent)
				.where(sql`${promptExpression} is not null`)
				.groupBy(promptExpression)
				.orderBy(asc(promptExpression)),
		]);

		return {
			actions: actions.map((row) => row.value),
			models: models.flatMap((row) => (row.value ? [row.value] : [])),
			prompts: prompts.flatMap((row) => (row.value ? [row.value] : [])),
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
				system: USAGE_EVENT_EVALUATION_SYSTEM_PROMPT,
				temperature: evaluationSelection.defaultTemperature ?? undefined,
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

const statsFilterInput = usageFiltersInput.omit({ cursor: true, limit: true, name: true });
const monthlyActiveUsersInput = z.object({
	timeZone: z.string().trim().min(1).max(100).optional(),
});

const getTrendGranularity = (filter: StatsFilter): TrendGranularity =>
	filter === "today" ? "hour" : "day";

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

// Tokens the model actually generated, reasoning tokens included. When the
// provider reports a trustworthy total/input split (OpenRouter, where
// completionTokens already includes reasoning), total - input captures
// everything generated without double-counting reasoning. Otherwise fall back
// to output + reasoning so separately reported reasoning tokens still count.
const generatedTokensExpression = sql`
	case
		when ${usageEvent.totalTokens} is not null
			and ${usageEvent.inputTokens} is not null
			and ${usageEvent.totalTokens} > ${usageEvent.inputTokens}
		then ${usageEvent.totalTokens} - ${usageEvent.inputTokens}
		else coalesce(${usageEvent.outputTokens}, 0) + coalesce(${usageEvent.reasoningTokens}, 0)
	end
`;

// Lower throughput is worse, so the labelled p90/p95 surface the slow tail
// (10th / 5th quantiles) while p50 stays the median.
const tokensPerSecondOrderExpression = sql`(
	(${generatedTokensExpression})::double precision /
	(${usageEvent.timeToCompletionMs}::double precision / 1000)
)`;
const tokensPerSecondFilter = sql`(
	where ${usageEvent.timeToCompletionMs} is not null
		and ${usageEvent.timeToCompletionMs} > 0
		and (${generatedTokensExpression}) > 0
)`;

// An agent run spans multiple UsageEvent rows sharing one traceId (agent chat
// plus every generateSection call). Counted as usage, the whole trace is a
// single event; events without a traceId count individually.
const distinctEventCountExpression = sql<number>`
	count(distinct coalesce(${usageEvent.traceId}, ${usageEvent.id}))
`.mapWith(Number);

const emptyPercentileStats = {
	p50: null,
	p90: null,
	p95: null,
};

interface UsageTrendRow {
	bucket: unknown;
	cost: unknown;
	costPerRequestP50: unknown;
	costPerRequestP90: unknown;
	costPerRequestP95: unknown;
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

interface MonthlyActiveUsersRow {
	activeUsers: unknown;
	bucket: unknown;
}

const buildTrendBucket = (bucket: string, row: UsageTrendRow | undefined) => ({
	bucket,
	cost: Number(row?.cost) || 0,
	costPerRequest: row
		? buildPercentileStats(row.costPerRequestP50, row.costPerRequestP90, row.costPerRequestP95, 6)
		: emptyPercentileStats,
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

const buildMonthlyActiveUsersTrend = (
	seriesRows: { bucket: string }[],
	trendRows: MonthlyActiveUsersRow[],
) => {
	const rowByBucket = new Map(trendRows.map((row) => [String(row.bucket), row]));
	return seriesRows.map((seriesRow) => {
		const bucket = String(seriesRow.bucket);
		const row = rowByBucket.get(bucket);
		return {
			activeUsers: Number(row?.activeUsers) || 0,
			bucket,
		};
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

	return {
		bucketExpression,
		localNowBucketExpression,
		seriesStartExpression,
		seriesStepExpression,
		timeZoneLiteral,
		trendGranularity,
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
		} = buildUsageStatsExpressions(filter, timeZone);
		const conditions = buildUsageFilterConditions(input);
		const filteredWhereClause = conditions.length > 0 ? and(...conditions) : undefined;

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
									then (${generatedTokensExpression})
									else 0
								end
							),
							0
						)
					`,
					totalCost: sum(usageEvent.cost),
					totalEvents: distinctEventCountExpression,
					totalTokens: sum(usageEvent.totalTokens),
				})
				.from(usageEvent)
				.where(filteredWhereClause),
			context.db
				.select({
					bucket: sql<string>`to_char(${bucketExpression}, 'YYYY-MM-DD"T"HH24:MI:SS')`,
					cost: sql<number>`coalesce(sum(${usageEvent.cost}), 0)`,
					costPerRequestP50: sql<number | null>`
						percentile_cont(0.5)
						within group (order by ${usageEvent.cost})
						filter (where ${usageEvent.cost} is not null)
					`,
					costPerRequestP90: sql<number | null>`
						percentile_cont(0.9)
						within group (order by ${usageEvent.cost})
						filter (where ${usageEvent.cost} is not null)
					`,
					costPerRequestP95: sql<number | null>`
						percentile_cont(0.95)
						within group (order by ${usageEvent.cost})
						filter (where ${usageEvent.cost} is not null)
					`,
					events: distinctEventCountExpression,
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
						within group (order by ${tokensPerSecondOrderExpression})
						filter ${tokensPerSecondFilter}
					`,
					tokensPerSecondP90: sql<number | null>`
						percentile_cont(0.1)
						within group (order by ${tokensPerSecondOrderExpression})
						filter ${tokensPerSecondFilter}
					`,
					tokensPerSecondP95: sql<number | null>`
						percentile_cont(0.05)
						within group (order by ${tokensPerSecondOrderExpression})
						filter ${tokensPerSecondFilter}
					`,
				})
				.from(usageEvent)
				.where(filteredWhereClause)
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

const getMonthlyActiveUsersHandler = authed
	.use(requiredAdminMiddleware)
	.input(monthlyActiveUsersInput)
	.handler(async ({ context, input }) => {
		const timeZone = resolveStatsTimeZone(input.timeZone);
		const timeZoneLiteral = toSqlStringLiteral(timeZone);
		const localTimestampExpression = sql`timezone(${timeZoneLiteral}, ${usageEvent.timestamp})`;
		const bucketExpression = sql<Date>`date_trunc('month', ${localTimestampExpression})`;
		const localNowBucketExpression = sql`date_trunc('month', timezone(${timeZoneLiteral}, now()))`;
		const seriesStartExpression = sql`coalesce(
			(select min(${bucketExpression}) from ${usageEvent}),
			${localNowBucketExpression}
		)`;
		const weekBucketExpression = sql<Date>`date_trunc('week', ${localTimestampExpression})`;
		const localNowWeekBucketExpression = sql`date_trunc('week', timezone(${timeZoneLiteral}, now()))`;
		const weekSeriesStartExpression = sql`coalesce(
			(select min(${weekBucketExpression}) from ${usageEvent}),
			${localNowWeekBucketExpression}
		)`;

		const [trendRows, seriesRows, weeklyRequestRows, weekSeriesRows] = await Promise.all([
			context.db
				.select({
					activeUsers: sql<number>`count(distinct ${usageEvent.userId})`,
					bucket: sql<string>`to_char(${bucketExpression}, 'YYYY-MM-DD"T"HH24:MI:SS')`,
				})
				.from(usageEvent)
				.groupBy(bucketExpression)
				.orderBy(bucketExpression),
			context.db.execute(
				sql<{ bucket: string }>`
					select to_char(series.bucket, 'YYYY-MM-DD"T"HH24:MI:SS') as bucket
					from generate_series(
						${seriesStartExpression},
						${localNowBucketExpression},
						interval '1 month'
					) as series(bucket)
				`,
			),
			context.db
				.select({
					bucket: sql<string>`to_char(${weekBucketExpression}, 'YYYY-MM-DD"T"HH24:MI:SS')`,
					requests: distinctEventCountExpression,
				})
				.from(usageEvent)
				.groupBy(weekBucketExpression)
				.orderBy(weekBucketExpression),
			context.db.execute(
				sql<{ bucket: string }>`
					select to_char(series.bucket, 'YYYY-MM-DD"T"HH24:MI:SS') as bucket
					from generate_series(
						${weekSeriesStartExpression},
						${localNowWeekBucketExpression},
						interval '1 week'
					) as series(bucket)
				`,
			),
		]);

		const weeklyRequestByBucket = new Map(
			weeklyRequestRows.map((row) => [String(row.bucket), Number(row.requests) || 0]),
		);

		return {
			timeZone,
			trend: buildMonthlyActiveUsersTrend(
				seriesRows.map((row) => ({ bucket: String(row.bucket) })),
				trendRows,
			),
			weeklyRequests: weekSeriesRows.map((row) => {
				const bucket = String(row.bucket);
				return {
					bucket,
					requests: weeklyRequestByBucket.get(bucket) ?? 0,
				};
			}),
		};
	});

export const usageHandler = {
	evaluate: evaluateUsageEventHandler,
	filterOptions: usageFilterOptionsHandler,
	findByRequestId: findByRequestIdHandler,
	get: getUsageEventHandler,
	list: listUsageEventsHandler,
	monthlyActiveUsers: getMonthlyActiveUsersHandler,
	stats: getUsageStatsHandler,
};
