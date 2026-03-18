import { sql } from "@repo/database";
import { database } from "@repo/database/client";
import { env } from "@repo/env";
import pgvector from "pgvector";
import { VoyageAIClient } from "voyageai";
import {
	buildRelevantProcedureTemplateReference,
	DEFAULT_PROCEDURE_TEMPLATE_REFERENCE,
} from "./fallback-templates/procedures";

const voyageClient = new VoyageAIClient({
	apiKey: env.VOYAGE_API_KEY as string,
});

const generateEmbeddings = async (content: string): Promise<number[]> => {
	const result = await voyageClient.embed({
		input: content,
		model: "voyage-3-large",
	});
	return result.data?.[0]?.embedding ?? [];
};

export const findRelevantTemplateForProcedure = async (notes: string): Promise<string> => {
	if (!notes.trim()) {
		return DEFAULT_PROCEDURE_TEMPLATE_REFERENCE;
	}

	try {
		const embedding = await generateEmbeddings(notes);
		const embeddingSql = pgvector.toSql(embedding);

		interface TemplateResult extends Record<string, unknown> {
			content: string;
			similarity: number;
		}

		const similarityResults = await database.execute<TemplateResult>(sql`
			SELECT
				content,
				(1 - (embedding <=> ${embeddingSql}::vector)) as similarity
			FROM "Template"
			WHERE embedding IS NOT NULL
			AND (1 - (embedding <=> ${embeddingSql}::vector)) > 0.6
			ORDER BY embedding <-> ${embeddingSql}::vector
			LIMIT 1
		`);

		if (similarityResults[0]?.content) {
			return buildRelevantProcedureTemplateReference(similarityResults[0].content);
		}
	} catch (error) {
		console.error("Failed to find relevant procedure template:", error);
	}

	return DEFAULT_PROCEDURE_TEMPLATE_REFERENCE;
};
