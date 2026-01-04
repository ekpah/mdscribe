import { type } from "@orpc/server";
import { count, isNull, sql, template } from "@repo/database";
import { env } from "@repo/env";
import pgvector from "pgvector";
import { VoyageAIClient } from "voyageai";

import { authed } from "@/orpc";
import { requiredAdminMiddleware } from "../middlewares/admin";

const voyageClient = new VoyageAIClient({
	apiKey: env.VOYAGE_API_KEY as string,
});

/**
 * Generate embeddings for content using Voyage AI
 */
async function generateEmbeddings(content: string): Promise<number[]> {
	const result = await voyageClient.embed({
		input: content,
		model: "voyage-3-large",
	});
	return result.data?.[0]?.embedding ?? [];
}

/**
 * Get embedding statistics - counts of templates with and without embeddings
 */
export const getEmbeddingStatsHandler = authed
	.use(requiredAdminMiddleware)
	.handler(async ({ context }) => {
		const [totalResult] = await context.db
			.select({ count: count() })
			.from(template);
		const total = totalResult?.count ?? 0;

		const [missingResult] = await context.db
			.select({ count: count() })
			.from(template)
			.where(isNull(template.embedding));
		const needingEmbeddings = missingResult?.count ?? 0;

		return {
			totalTemplates: total,
			templatesWithoutEmbeddings: needingEmbeddings,
			templatesWithEmbeddings: total - needingEmbeddings,
		};
	});

/**
 * Migration mode - 'missing' only generates for templates without embeddings,
 * 'all' regenerates for all templates
 */
type MigrationMode = "missing" | "all";

/**
 * Migrate template embeddings - generates or regenerates embeddings for templates
 */
export const migrateEmbeddingsHandler = authed
	.use(requiredAdminMiddleware)
	.input(
		type<{
			mode?: MigrationMode;
			batchSize?: number;
			delayBetweenBatches?: number;
		}>(),
	)
	.handler(async ({ input, context }) => {
		const {
			mode = "missing",
			batchSize = 10,
			delayBetweenBatches = 1000,
		} = input;

		const stats = {
			total: 0,
			processed: 0,
			failed: 0,
			errors: [] as Array<{ templateId: string; error: string }>,
		};

		// Count total templates
		const [totalResult] = await context.db
			.select({ count: count() })
			.from(template);
		stats.total = totalResult?.count ?? 0;

		// Get templates to process based on mode
		let templatesToProcess: Array<{ id: string; content: string }>;

		if (mode === "missing") {
			templatesToProcess = await context.db
				.select({ id: template.id, content: template.content })
				.from(template)
				.where(isNull(template.embedding));
		} else {
			templatesToProcess = await context.db
				.select({ id: template.id, content: template.content })
				.from(template);
		}

		if (templatesToProcess.length === 0) {
			return {
				totalTemplates: stats.total,
				templatesProcessed: 0,
				successfulEmbeddings: 0,
				failedEmbeddings: 0,
				errors: [],
			};
		}

		// Process templates in batches
		for (let i = 0; i < templatesToProcess.length; i += batchSize) {
			const batch = templatesToProcess.slice(i, i + batchSize);

			for (const templateItem of batch) {
				try {
					const embedding = await generateEmbeddings(templateItem.content);
					const embeddingSql = pgvector.toSql(embedding);

					await context.db.execute(sql`
						UPDATE "Template"
						SET "embedding" = ${sql.raw(embeddingSql)}::vector
						WHERE "id" = ${templateItem.id}
					`);
					stats.processed++;
				} catch (error) {
					stats.failed++;
					const errorMessage =
						error instanceof Error ? error.message : "Unknown error";
					stats.errors.push({
						templateId: templateItem.id,
						error: errorMessage,
					});
				}
			}

			// Wait between batches to avoid rate limiting
			if (
				i + batchSize < templatesToProcess.length &&
				delayBetweenBatches > 0
			) {
				await new Promise((resolve) => setTimeout(resolve, delayBetweenBatches));
			}
		}

		const modeText =
			mode === "missing"
				? "Missing embeddings generated"
				: "All embeddings regenerated";

		return {
			totalTemplates: stats.total,
			templatesProcessed: templatesToProcess.length,
			successfulEmbeddings: stats.processed,
			failedEmbeddings: stats.failed,
			errors: stats.errors,
			message: `${modeText}: ${stats.processed} embedded, ${stats.failed} failed`,
		};
	});

export const embeddingsHandler = {
	stats: getEmbeddingStatsHandler,
	migrate: migrateEmbeddingsHandler,
};
