import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { type } from "@orpc/server";
import { env } from "@repo/env";
import { generateObject } from "ai";
import { z } from "zod";
import { authed } from "@/orpc";

const openrouter = createOpenRouter({
	apiKey: env.OPENROUTER_API_KEY as string,
});

/**
 * Field mapping type for PDF form fields
 */
interface FieldMapping {
	fieldName: string;
	label: string;
	description: string;
}

/**
 * Enhanced field mapping response schema
 */
const enhancedFieldMappingSchema = z.object({
	fieldMapping: z.array(
		z.object({
			fieldName: z.string(),
			label: z.string(),
			description: z.string(),
		}),
	),
});

/**
 * Parse and enhance PDF form fields using AI
 * Takes a PDF file (as base64) and field mapping, returns enhanced labels/descriptions
 */
export const parseFormHandler = authed
	.input(
		type<{
			fileBase64: string;
			fieldMapping: FieldMapping[];
		}>(),
	)
	.handler(async ({ input }) => {
		const { fileBase64, fieldMapping } = input;

		// Create prompt for Gemini to enhance field mappings
		const prompt = `Du analysierst ein PDF-Formular-Dokument. Ich habe die folgenden Formularfeld-Zuordnungen aus dem PDF extrahiert:

${JSON.stringify(fieldMapping, null, 2)}

Für jede Feldzuordnung:
1. Schlage ein besseres, aussagekräftigeres Label vor
2. Gib eine klare und prägnante Beschreibung an, wofür dieses Feld verwendet wird

Gib deine Antwort als JSON-Objekt mit genau dieser Struktur zurück:
{
  "fieldMapping": [{
    "fieldName": "[original_field_name]",
    "label": "[verbessertes_label]",
    "description": "[klare Beschreibung des Feldes]"
  }]
}

Achte darauf:
- Alle originalen fieldName-Werte beizubehalten
- Die Beschreibungen kurz und aussagekräftig zu halten
- fieldName exakt wie im Input zu übernehmen`;

		const model = openrouter("google/gemini-2.5-flash");

		const { object } = await generateObject({
			model,
			messages: [
				{
					role: "user",
					content: [{ type: "text", text: prompt }],
				},
				{
					role: "user",
					content: [
						{
							type: "file",
							data: `data:application/pdf;base64,${fileBase64}`,
							mediaType: "application/pdf",
						},
					],
				},
			],
			temperature: 0.3,
			schema: enhancedFieldMappingSchema,
		});

		return object;
	});

export const documentsHandler = {
	parseForm: parseFormHandler,
};
