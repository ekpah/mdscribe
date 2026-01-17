import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { type } from "@orpc/server";
import { usageEvent } from "@repo/database";
import { env } from "@repo/env";
import { generateObject } from "ai";
import { z } from "zod";
import { buildUsageEventData } from "@/lib/usage-logging";
import { authed } from "@/orpc";
import { type FieldMapping, pdfDocumentConfigs } from "./config";

const openrouter = createOpenRouter({
	apiKey: env.OPENROUTER_API_KEY as string,
});

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
	.handler(async ({ input, context }) => {
		const { fileBase64, fieldMapping } = input;
		const config = pdfDocumentConfigs.parseForm;

		// Decode base64 to Uint8Array using Node.js Buffer (more efficient than manual loop)
		const bytes = new Uint8Array(Buffer.from(fileBase64, "base64"));

		// Build prompt from config
		const promptMessages = config.prompt({ fieldMapping });
		const promptText = promptMessages[0].content;

		const model = openrouter("google/gemini-3-flash-preview");

		const result = await generateObject({
			model,
			messages: [
				{
					role: "user",
					content: [{ type: "text", text: promptText }],
				},
				{
					role: "user",
					content: [
						{
							type: "file",
							data: bytes,
							mediaType: "application/pdf",
						},
					],
				},
			],
			temperature: config.modelConfig.temperature ?? 0.3,
			schema: enhancedFieldMappingSchema,
			experimental_telemetry: { isEnabled: true },
		});

		const { object, usage } = result;

		// Extract OpenRouter usage if available from provider metadata
		const providerMetadata = (
			result as { providerMetadata?: Record<string, unknown> }
		).providerMetadata;
		const openrouterUsage = (
			providerMetadata?.openrouter as {
				usage?: {
					promptTokens?: number;
					completionTokens?: number;
					totalTokens?: number;
					cost?: number;
				};
			}
		)?.usage;

		// Log usage event
		await context.db.insert(usageEvent).values(
			buildUsageEventData({
				userId: context.session.user.id,
				name: "ai_pdf_form_parsing",
				model: "google/gemini-2.5-flash",
				openRouterUsage: openrouterUsage
					? {
							promptTokens: openrouterUsage.promptTokens ?? 0,
							completionTokens: openrouterUsage.completionTokens ?? 0,
							totalTokens: openrouterUsage.totalTokens ?? 0,
							cost: openrouterUsage.cost,
						}
					: null,
				standardUsage: usage
					? {
							inputTokens: (usage as { promptTokens?: number }).promptTokens,
							outputTokens: (usage as { completionTokens?: number })
								.completionTokens,
							totalTokens: (usage as { totalTokens?: number }).totalTokens,
						}
					: undefined,
				inputData: { fieldCount: fieldMapping.length },
				metadata: {
					promptName: config.promptName,
					promptSource: "local",
				},
			}),
		);

		return object;
	});

export const documentsHandler = {
	parseForm: parseFormHandler,
};
