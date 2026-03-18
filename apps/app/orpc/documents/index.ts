import { ORPCError, type } from "@orpc/server";
import { usageEvent } from "@repo/database";
import { generateObject, generateText } from "ai";
import { z } from "zod";

import { buildUsageEventData, extractOpenRouterUsage } from '@/lib/usage-logging';
import type { StandardUsage } from '@/lib/usage-logging';
import { authed } from "@/orpc";
import { requiredAdminMiddleware } from "@/orpc/middlewares/admin";
import { resolveModel, resolveProviderModel } from "@/orpc/scribe/providers";
import { pdfDocumentConfigs } from './config';
import type { FieldMapping } from './config';

/**
 * Enhanced field mapping response schema
 */
const enhancedFieldMappingSchema = z.object({
	fieldMapping: z.array(
		z.object({
			description: z.string(),
			fieldName: z.string(),
			label: z.string(),
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
	// Backward compatibility while frontend payload migrates fully.
	connectionId: z.string().min(1).optional(),
	fileBase64: z.string().min(1).optional(),
	imagesBase64: z.array(z.string().min(1)).optional(),
	model: z.string().min(1),
	providerId: z.string().min(1).optional(),
});

const stripCodeFence = (markdown: string): string => {
	const trimmed = markdown.trim();
	const fencedMatch = trimmed.match(/^```(?:md|markdown)?\n([\s\S]*?)\n```$/i);
	if (!fencedMatch) {return trimmed;}
	return fencedMatch[1]?.trim() ?? "";
};

/**
 * Parse and enhance PDF form fields using AI.
 */
const parseFormHandler = authed
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
			experimental_telemetry: { isEnabled: true },
			messages: [
				{
					content: [{ text: promptText, type: "text" }],
					role: "user",
				},
				{
					content: [
						{
							data: bytes,
							mediaType: "application/pdf",
							type: "file",
						},
					],
					role: "user",
				},
			],
			model: resolvedModel.model,
			providerOptions: resolvedModel.isOpenRouter
				? {
						openrouter: {
							usage: { include: true },
							user: context.session.user.email,
						},
					}
				: undefined,
			schema: enhancedFieldMappingSchema,
			temperature: config.modelConfig.temperature ?? 0.3,
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
				inputData: { fieldCount: fieldMapping.length },
				metadata: {
					promptName: config.promptName,
					promptSource: "local",
				},
				model: resolvedModel.modelName,
				name: "ai_pdf_form_parsing",
				openRouterUsage,
				standardUsage: usage as StandardUsage,
				userId: context.session.user.id,
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

		const userContent: (| { type: "text"; text: string }
			| { type: "image"; image: Uint8Array; mediaType: string }
			| { type: "file"; data: Uint8Array; mediaType: string })[] = [{ text: ocrToMarkdownPrompt, type: "text" }];

		let fileSizeBytes = 0;
		if (parsed.imagesBase64?.length) {
			for (const imgBase64 of parsed.imagesBase64) {
				const bytes = new Uint8Array(Buffer.from(imgBase64, "base64"));
				fileSizeBytes += bytes.length;
				userContent.push({
					image: bytes,
					mediaType: "image/jpeg",
					type: "image",
				});
			}
		} else {
			const {fileBase64} = parsed;
			if (!fileBase64) {
				throw new ORPCError("BAD_REQUEST", {
					message: "fileBase64 fehlt",
				});
			}
			const bytes = new Uint8Array(Buffer.from(fileBase64, "base64"));
			fileSizeBytes = bytes.length;
			userContent.push({
				data: bytes,
				mediaType: "application/pdf",
				type: "file",
			});
		}

		let result: Awaited<ReturnType<typeof generateText>>;
		try {
			result = await generateText({
				experimental_telemetry: { isEnabled: true },
				maxOutputTokens: 24_000,
				messages: [{ content: userContent, role: "user" }],
				model: resolvedModel.model,
				providerOptions: resolvedModel.isOpenRouter
					? {
							openrouter: {
								usage: { include: true },
								user: context.session.user.email,
							},
						}
					: undefined,
				temperature: 0,
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
				inputData: {
					fileSizeBytes,
					fileType: parsed.imagesBase64?.length ? "images" : "pdf",
					pageCount: parsed.imagesBase64?.length,
				},
				metadata: {
					promptName: "pdf_ocr_markdown",
					promptSource: "local",
					providerId,
				},
				model: resolvedModel.modelName,
				name: "ai_pdf_ocr_markdown",
				openRouterUsage,
				result: markdown,
				standardUsage: result.usage as StandardUsage,
				userId: context.session.user.id,
			}),
		);

		return { markdown };
	});

export const documentsHandler = {
	ocrToMarkdown: ocrToMarkdownHandler,
	parseForm: parseFormHandler,
};
