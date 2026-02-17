import { type } from "@orpc/server";
import { eq, favourites, inArray, sql, template } from "@repo/database";
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
type TemplateSearchResult = {
	id: string;
	title: string;
	category: string;
	content: string;
	authorId: string;
	updatedAt: Date;
	similarity: number;
};

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

		// Vector similarity search using Drizzle sql template
		const similarityResults = await context.db.execute<TemplateSearchResult>(sql`
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
		`);

		const templateIds = similarityResults.rows.map((t) => t.id);

		if (templateIds.length === 0) {
			return { templates: [], count: 0 };
		}

		// Fetch favourite users for each template
		const favouriteData = await context.db
			.select({
				templateId: favourites.templateId,
				userId: favourites.userId,
			})
			.from(favourites)
			.where(inArray(favourites.templateId, templateIds));

		// Group favourites by template
		const favouritesByTemplate = favouriteData.reduce(
			(acc, fav) => {
				if (!acc[fav.templateId]) {
					acc[fav.templateId] = [];
				}
				acc[fav.templateId].push({ id: fav.userId });
				return acc;
			},
			{} as Record<string, Array<{ id: string }>>,
		);

		// Merge similarity scores with template data
		const templates = similarityResults.rows.map((simResult) => {
			const favs = favouritesByTemplate[simResult.id] || [];
			return {
				...simResult,
				favouriteOf: favs,
				_count: { favouriteOf: favs.length },
			};
		});

		return { templates, count: templates.length };
	});
