import { type } from "@orpc/server";
import { env } from "@repo/env";
import pgvector from "pgvector";
import { VoyageAIClient } from "voyageai";
import { authed } from "@/orpc";

const voyageClient = new VoyageAIClient({
	apiKey: env.VOYAGE_API_KEY as string,
});

/**
 * Template search result type
 */
interface TemplateSearchResult {
	id: string;
	title: string;
	category: string;
	content: string;
	authorId: string;
	updatedAt: Date;
	similarity: number;
}

/**
 * Generate embeddings for a query using Voyage AI
 */
async function generateEmbeddings(
	content: string,
	differentialDiagnosis?: string,
): Promise<number[]> {
	const contentWithMetadata = differentialDiagnosis
		? `---
diagnosis: ${differentialDiagnosis}
---
${content}`
		: content;

	const result = await voyageClient.embed({
		input: contentWithMetadata,
		model: "voyage-3-large",
	});

	return result.data?.[0]?.embedding ?? [];
}

/**
 * Find relevant templates using vector similarity search
 */
export const findRelevantTemplateHandler = authed
	.input(
		type<{
			query: string;
			differentialDiagnosis?: string;
		}>(),
	)
	.handler(async ({ input, context }) => {
		const { query, differentialDiagnosis } = input;

		if (!query || typeof query !== "string") {
			return { templates: [], count: 0 };
		}

		// Generate embeddings for the query
		const embedding = await generateEmbeddings(query, differentialDiagnosis);
		const embeddingSql = pgvector.toSql(embedding);

		// Vector similarity search
		const similarityResults = await context.db.$queryRaw<TemplateSearchResult[]>`
			SELECT
				id,
				title,
				category,
				content,
				"authorId",
				"updatedAt",
				(1 - (embedding <=> ${embeddingSql}::vector)) as similarity
			FROM "Template"
			WHERE embedding IS NOT NULL
			AND (1 - (embedding <=> ${embeddingSql}::vector)) > 0.3
			ORDER BY embedding <-> ${embeddingSql}::vector
			LIMIT 5
		`;

		const templateIds = similarityResults.map((t) => t.id);

		if (templateIds.length === 0) {
			return { templates: [], count: 0 };
		}

		// Fetch complete template data with favorites information
		const templatesWithFavorites = await context.db.template.findMany({
			where: { id: { in: templateIds } },
			include: {
				favouriteOf: { select: { id: true } },
				_count: { select: { favouriteOf: true } },
			},
		});

		// Merge similarity scores with template data
		const templates = similarityResults.map((simResult) => {
			const templateData = templatesWithFavorites.find(
				(t) => t.id === simResult.id,
			);
			return {
				...simResult,
				favouriteOf: templateData?.favouriteOf || [],
				_count: templateData?._count || { favouriteOf: 0 },
			};
		});

		return { templates, count: templates.length };
	});
