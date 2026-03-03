import { type } from "@orpc/server";
import { count, eq, isNull, template } from "@repo/database";
import { env } from "@repo/env";
import { setTimeout as sleep } from "node:timers/promises";
import { VoyageAIClient } from "voyageai";

import { authed } from "@/orpc";
import { requiredAdminMiddleware } from "../middlewares/admin";

const voyageClient = new VoyageAIClient({
	apiKey: env.VOYAGE_API_KEY as string,
});

/**
 * Generate embeddings for content using Voyage AI
 */
const generateEmbeddings = async (content: string): Promise<number[]> => {
	const result = await voyageClient.embed({
		input: content,
		model: "voyage-3-large",
	});
	return result.data?.[0]?.embedding ?? [];
};

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
			templatesWithEmbeddings: total - needingEmbeddings,
			templatesWithoutEmbeddings: needingEmbeddings,
			totalTemplates: total,
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
			errors: [] as { templateId: string; error: string }[],
			failed: 0,
			processed: 0,
			total: 0,
		};

		// Count total templates
		const [totalResult] = await context.db
			.select({ count: count() })
			.from(template);
		stats.total = totalResult?.count ?? 0;

		// Get templates to process based on mode
		let templatesToProcess: { id: string; content: string }[];

		if (mode === "missing") {
			templatesToProcess = await context.db
				.select({ content: template.content, id: template.id })
				.from(template)
				.where(isNull(template.embedding));
		} else {
			templatesToProcess = await context.db
				.select({ content: template.content, id: template.id })
				.from(template);
		}

		if (templatesToProcess.length === 0) {
			return {
				errors: [],
				failedEmbeddings: 0,
				successfulEmbeddings: 0,
				templatesProcessed: 0,
				totalTemplates: stats.total,
			};
		}

		// Process templates in batches
		for (let i = 0; i < templatesToProcess.length; i += batchSize) {
			const batch = templatesToProcess.slice(i, i + batchSize);

			for (const templateItem of batch) {
				try {
					const embedding = await generateEmbeddings(templateItem.content);
					await context.db
						.update(template)
						.set({ embedding })
						.where(eq(template.id, templateItem.id));
					stats.processed += 1;
				} catch (error) {
					stats.failed += 1;
					const errorMessage =
						error instanceof Error ? error.message : "Unknown error";
					stats.errors.push({
						error: errorMessage,
						templateId: templateItem.id,
					});
				}
			}

			// Wait between batches to avoid rate limiting
				if (
					i + batchSize < templatesToProcess.length &&
					delayBetweenBatches > 0
				) {
					await sleep(delayBetweenBatches);
				}
			}

		const modeText =
			mode === "missing"
				? "Missing embeddings generated"
				: "All embeddings regenerated";

		return {
			errors: stats.errors,
			failedEmbeddings: stats.failed,
			message: `${modeText}: ${stats.processed} embedded, ${stats.failed} failed`,
			successfulEmbeddings: stats.processed,
			templatesProcessed: templatesToProcess.length,
			totalTemplates: stats.total,
		};
	});

export const embeddingsHandler = {
	migrate: migrateEmbeddingsHandler,
	stats: getEmbeddingStatsHandler,
};
