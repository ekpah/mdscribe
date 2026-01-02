import { type } from "@orpc/server";
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
		const total = await context.db.template.count();

		const [{ count }] = await context.db.$queryRaw<[{ count: bigint }]>`
			SELECT COUNT(*) as count FROM "Template" WHERE embedding IS NULL
		`;
		const needingEmbeddings = Number(count);

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
		const { mode = "missing", batchSize = 10, delayBetweenBatches = 1000 } = input;

		const stats = {
			total: 0,
			processed: 0,
			failed: 0,
			errors: [] as Array<{ templateId: string; error: string }>,
		};

		// Count total templates
		stats.total = await context.db.template.count();

		// Get templates to process based on mode
		let templatesToProcess: Array<{ id: string; content: string }>;

		if (mode === "missing") {
			templatesToProcess = await context.db.$queryRaw<
				Array<{ id: string; content: string }>
			>`SELECT id, content FROM "Template" WHERE embedding IS NULL`;
		} else {
			templatesToProcess = await context.db.$queryRaw<
				Array<{ id: string; content: string }>
			>`SELECT id, content FROM "Template"`;
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

			for (const template of batch) {
				try {
					const embedding = await generateEmbeddings(template.content);
					await context.db.$queryRaw`
						UPDATE "Template"
						SET "embedding" = ${pgvector.toSql(embedding)}::vector
						WHERE "id" = ${template.id}
					`;
					stats.processed++;
				} catch (error) {
					stats.failed++;
					const errorMessage =
						error instanceof Error ? error.message : "Unknown error";
					stats.errors.push({
						templateId: template.id,
						error: errorMessage,
					});
				}
			}

			// Wait between batches to avoid rate limiting
			if (i + batchSize < templatesToProcess.length && delayBetweenBatches > 0) {
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
