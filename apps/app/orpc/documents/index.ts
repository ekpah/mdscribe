import { ORPCError, type } from "@orpc/server";
import { usageEvent } from "@repo/database";
import { generateObject, generateText } from "ai";
import { z } from "zod";

import {
	buildUsageEventData,
	extractOpenRouterUsage,
	type StandardUsage,
} from "@/lib/usage-logging";
import { authed } from "@/orpc";
import { requiredAdminMiddleware } from "../middlewares/admin";
import { resolveModel, resolveProviderModel } from "../scribe/providers";
import { type FieldMapping, pdfDocumentConfigs } from "./config";

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

const ocrToMarkdownPrompt = [
	"Du extrahierst den Inhalt eines PDF-Dokuments per OCR.",
	"Gib ausschließlich Markdown zurück und nutze keine Code-Fences.",
	"Erhalte die Dokumentstruktur mit Überschriften, Listen und Tabellen so gut wie möglich.",
	"Wenn Text unlesbar ist, markiere ihn als [unlesbar] statt Inhalte zu erfinden.",
].join("\n");

const ocrToMarkdownInput = z.object({
	fileBase64: z.string().min(1).optional(),
	imagesBase64: z.array(z.string().min(1)).optional(),
	model: z.string().min(1),
	providerId: z.string().min(1).optional(),
	// Backward compatibility while frontend payload migrates fully.
	connectionId: z.string().min(1).optional(),
});

function stripCodeFence(markdown: string): string {
	const trimmed = markdown.trim();
	const fencedMatch = trimmed.match(/^```(?:md|markdown)?\n([\s\S]*?)\n```$/i);
	if (!fencedMatch) return trimmed;
	return fencedMatch[1]?.trim() ?? "";
}

/**
 * Parse and enhance PDF form fields using AI.
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

		const bytes = new Uint8Array(Buffer.from(fileBase64, "base64"));
		const promptMessages = config.prompt({ fieldMapping });
		const promptText = promptMessages[0].content;
		const resolvedModel = await resolveModel(context.db, {
			requireFiles: true,
		});

		const result = await generateObject({
			model: resolvedModel.model,
			providerOptions: resolvedModel.isOpenRouter
				? {
						openrouter: {
							usage: { include: true },
							user: context.session.user.email,
						},
					}
				: undefined,
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
		const openRouterUsage = resolvedModel.isOpenRouter
			? extractOpenRouterUsage(
					(result as { providerMetadata?: Record<string, unknown> })
						.providerMetadata,
				)
			: undefined;

		await context.db.insert(usageEvent).values(
			buildUsageEventData({
				userId: context.session.user.id,
				name: "ai_pdf_form_parsing",
				model: resolvedModel.modelName,
				openRouterUsage,
				standardUsage: usage as StandardUsage,
				inputData: { fieldCount: fieldMapping.length },
				metadata: {
					promptName: config.promptName,
					promptSource: "local",
				},
			}),
		);

		return object;
	});

const ocrToMarkdownHandler = authed
	.use(requiredAdminMiddleware)
	.input(type<z.infer<typeof ocrToMarkdownInput>>())
	.handler(async ({ input, context }) => {
		const parsed = ocrToMarkdownInput.parse(input);

		if (!parsed.fileBase64 && !parsed.imagesBase64?.length) {
			throw new ORPCError("BAD_REQUEST", {
				message: "fileBase64 oder imagesBase64 muss angegeben werden",
			});
		}

		const providerId = parsed.providerId ?? parsed.connectionId;
		if (!providerId) {
			throw new ORPCError("BAD_REQUEST", {
				message: "providerId fehlt",
			});
		}

		const resolvedModel = await resolveProviderModel(
			providerId,
			parsed.model,
			context.db,
		);

		const userContent: Array<
			| { type: "text"; text: string }
			| { type: "image"; image: Uint8Array; mediaType: string }
			| { type: "file"; data: Uint8Array; mediaType: string }
		> = [{ type: "text", text: ocrToMarkdownPrompt }];

		let fileSizeBytes = 0;
		if (parsed.imagesBase64?.length) {
			for (const imgBase64 of parsed.imagesBase64) {
				const bytes = new Uint8Array(Buffer.from(imgBase64, "base64"));
				fileSizeBytes += bytes.length;
				userContent.push({
					type: "image",
					image: bytes,
					mediaType: "image/jpeg",
				});
			}
		} else {
			const fileBase64 = parsed.fileBase64;
			if (!fileBase64) {
				throw new ORPCError("BAD_REQUEST", {
					message: "fileBase64 fehlt",
				});
			}
			const bytes = new Uint8Array(Buffer.from(fileBase64, "base64"));
			fileSizeBytes = bytes.length;
			userContent.push({
				type: "file",
				data: bytes,
				mediaType: "application/pdf",
			});
		}

		let result: Awaited<ReturnType<typeof generateText>>;
		try {
			result = await generateText({
				model: resolvedModel.model,
				temperature: 0,
				maxOutputTokens: 24_000,
				providerOptions: resolvedModel.isOpenRouter
					? {
							openrouter: {
								usage: { include: true },
								user: context.session.user.email,
							},
						}
					: undefined,
				messages: [{ role: "user", content: userContent }],
				experimental_telemetry: { isEnabled: true },
			});
		} catch (error) {
			const details =
				error instanceof Error ? error.message : "Unbekannter Fehler";
			throw new ORPCError("BAD_REQUEST", {
				message: `OCR fehlgeschlagen. Bitte ein OCR-fähiges Modell wählen. (${details})`,
			});
		}

		const openRouterUsage = resolvedModel.isOpenRouter
			? extractOpenRouterUsage(
					(result as { providerMetadata?: Record<string, unknown> })
						.providerMetadata,
				)
			: null;
		const markdown = stripCodeFence(result.text);

		await context.db.insert(usageEvent).values(
			buildUsageEventData({
				userId: context.session.user.id,
				name: "ai_pdf_ocr_markdown",
				model: resolvedModel.modelName,
				openRouterUsage,
				standardUsage: result.usage as StandardUsage,
				inputData: {
					fileType: parsed.imagesBase64?.length ? "images" : "pdf",
					fileSizeBytes,
					pageCount: parsed.imagesBase64?.length,
				},
				metadata: {
					promptName: "pdf_ocr_markdown",
					promptSource: "local",
					providerId,
				},
				result: markdown,
			}),
		);

		return { markdown };
	});

export const documentsHandler = {
	parseForm: parseFormHandler,
	ocrToMarkdown: ocrToMarkdownHandler,
};
