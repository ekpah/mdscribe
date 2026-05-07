import { ORPCError } from "@orpc/server";
import {
	and,
	aiDefaults,
	aiScribeFormConfig,
	avg,
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
import type { Database } from "@repo/database";
import { generateObject } from "ai";
import { z } from "zod";

import { USER_MESSAGES } from "@/lib/user-messages";
import { authed } from "@/orpc";
import { requiredAdminMiddleware } from "@/orpc/middlewares/admin";
import { PLAYGROUND_EVALUATION_SYSTEM_PROMPT } from "@/orpc/scribe/prompts/core/evaluation";
import { resolveModelByRecordId } from "@/orpc/scribe/providers";

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
	const endpoint = metadata.endpoint;
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
	const endpoint = metadata.endpoint;
	if (typeof endpoint === "string" && endpoint.trim().length > 0) {
		return endpoint;
	}

	const promptName = metadata.promptName;
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
				timestamp: usageEvent.timestamp,
				timeToCompletionMs: usageEvent.timeToCompletionMs,
				timeToFirstTokenMs: usageEvent.timeToFirstTokenMs,
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
				timestamp: usageEvent.timestamp,
				timeToCompletionMs: usageEvent.timeToCompletionMs,
				timeToFirstTokenMs: usageEvent.timeToFirstTokenMs,
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
				timestamp: usageEvent.timestamp,
				timeToCompletionMs: usageEvent.timeToCompletionMs,
				timeToFirstTokenMs: usageEvent.timeToFirstTokenMs,
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

		const defaults = await context.db.query.aiDefaults.findFirst({
			where: eq(aiDefaults.id, "global"),
		});
		const evaluationModelRecordId = defaults?.defaultEvaluationModel;
		if (!evaluationModelRecordId) {
			throw new ORPCError("BAD_REQUEST", {
				message: "Kein Standard-Evaluationsmodell konfiguriert",
			});
		}

		const evaluationModel = await resolveModelByRecordId(evaluationModelRecordId, context.db);
		const metadata = toMetadataRecord(event.metadata);
		const documentType = getDocumentTypeForEvaluation(event.name, metadata);

		let evaluation;
		try {
			evaluation = await generateObject({
				model: evaluationModel.model,
				schema: usageEvaluationSchema,
				system: PLAYGROUND_EVALUATION_SYSTEM_PROMPT,
				prompt: `Bewerte ausschliesslich die Modell-Ausgabe.

Dokumenttyp: ${documentType}

Nutzergegebene Eingaben, Prompt-Spezifika und ggf. Vorlage:
${JSON.stringify(event.inputData ?? {}, null, 2)}

Modell-Ausgabe:
${event.result}`,
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
});

const getDateRangeStart = (filter: "today" | "week" | "month" | "all" | undefined): Date | null => {
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

const getUsageStatsHandler = authed
	.use(requiredAdminMiddleware)
	.input(statsFilterInput)
	.handler(async ({ context, input }) => {
		const dateStart = getDateRangeStart(input.filter);

		const whereClause = dateStart ? gte(usageEvent.timestamp, dateStart) : undefined;

		const [stats] = await context.db
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
			.where(whereClause);

		const averageTimeToCompletionMs = toFiniteMetric(stats?.averageTimeToCompletionMs);
		const averageTimeToFirstTokenMs = toFiniteMetric(stats?.averageTimeToFirstTokenMs);
		const timedTotalCompletionMs = Number(stats?.timedTotalCompletionMs) || 0;
		const timedTotalTokens = Number(stats?.timedTotalTokens) || 0;

		return {
			activeUsers: Number(stats?.activeUsers) || 0,
			averageTimeToCompletionMs: averageTimeToCompletionMs !== null
				? Math.round(averageTimeToCompletionMs)
				: null,
			averageTimeToFirstTokenMs: averageTimeToFirstTokenMs !== null
				? Math.round(averageTimeToFirstTokenMs)
				: null,
			tokensPerSecond:
				timedTotalCompletionMs > 0
					? Number((timedTotalTokens / (timedTotalCompletionMs / 1000)).toFixed(1))
					: null,
			totalCost: Number(stats?.totalCost) || 0,
			totalEvents: stats?.totalEvents ?? 0,
			totalTokens: Number(stats?.totalTokens) || 0,
		};
	});

export const usageHandler = {
	evaluate: evaluateUsageEventHandler,
	findByRequestId: findByRequestIdHandler,
	get: getUsageEventHandler,
	list: listUsageEventsHandler,
	stats: getUsageStatsHandler,
};
