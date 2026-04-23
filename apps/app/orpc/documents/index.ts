import { ORPCError, type } from "@orpc/server";
import {
	and,
	count,
	desc,
	documentTemplate,
	eq,
	usageEvent,
	user,
} from "@repo/database";
import { generateObject, generateText } from "ai";
import { z } from "zod";

import { buildUsageEventData, extractOpenRouterUsage } from '@/lib/usage-logging';
import {
	buildParsedMarkdocFromFieldDefinitions,
} from "@/app/documents/_lib/build-parsed-markdoc-from-field-definitions";
import {
	documentFieldDefinitionsSchema,
	type DocumentFieldDefinition,
} from "@/app/documents/_lib/types";
import type { StandardUsage } from '@/lib/usage-logging';
import { authed, pub } from "@/orpc";
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

const MAX_CATEGORY_SUGGESTIONS = 10;

const addCategories = (
	target: string[],
	seen: Set<string>,
	categories: string[],
	limit: number,
) => {
	for (const category of categories) {
		const normalized = category.trim();
		if (!normalized) {
			continue;
		}

		const key = normalized.toLowerCase();
		if (seen.has(key)) {
			continue;
		}

		seen.add(key);
		target.push(normalized);
		if (target.length >= limit) {
			return;
		}
	}
};

const createDocumentTemplateInput = z.object({
	category: z.string().min(1, "Category is required"),
	fieldDefinitions: documentFieldDefinitionsSchema,
	pdfBase64: z.string().min(1, "PDF content is required"),
	title: z.string().min(1, "Title is required"),
});

const updateDocumentTemplateInput = z.object({
	category: z.string().min(1, "Category is required"),
	fieldDefinitions: documentFieldDefinitionsSchema,
	id: z.string().min(1),
	pdfBase64: z.string().min(1).optional(),
	title: z.string().min(1, "Title is required"),
});

const getDocumentTemplateInput = z.object({
	id: z.string(),
});

const decodePdfBase64 = (value: string): Uint8Array => (
	new Uint8Array(Buffer.from(value, "base64"))
);

const encodePdfBase64 = (value: Uint8Array): string =>
	Buffer.from(value).toString("base64");

const ensureValidFieldDefinitions = (
	fieldDefinitions: DocumentFieldDefinition[],
): {
	normalizedFieldDefinitions: DocumentFieldDefinition[];
} => {
	try {
		const { normalizedFieldDefinitions } =
			buildParsedMarkdocFromFieldDefinitions(fieldDefinitions);
		return { normalizedFieldDefinitions };
	} catch (error) {
		throw new ORPCError("BAD_REQUEST", {
			message:
				error instanceof Error && error.message
					? error.message
					: "Die Felddefinitionen ergeben kein gültiges Inputs-Format.",
		});
	}
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
		let resolvedModel: Awaited<ReturnType<typeof resolveModel>>;
		try {
			resolvedModel = await resolveModel(context.db, {
				requireFiles: true,
			});
		} catch (error) {
			const details =
				error instanceof Error ? error.message : "Unbekannter Fehler";
			throw new ORPCError("BAD_REQUEST", {
				message: `Kein kompatibles KI-Modell für PDF-Analyse verfügbar. (${details})`,
			});
		}

		let result: Awaited<ReturnType<typeof generateObject>>;
		try {
			result = await generateObject({
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
		} catch (error) {
			const details =
				error instanceof Error ? error.message : "Unbekannter Fehler";
			throw new ORPCError("BAD_REQUEST", {
				message: `Eingaben konnten nicht mit KI optimiert werden. (${details})`,
			});
		}

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

const listDocumentTemplatesHandler = pub.handler(async ({ context }) => {
	return context.db
		.select({
			author: {
				email: user.email,
				id: user.id,
				name: user.name,
			},
			authorId: documentTemplate.authorId,
			category: documentTemplate.category,
			createdAt: documentTemplate.createdAt,
			id: documentTemplate.id,
			title: documentTemplate.title,
			updatedAt: documentTemplate.updatedAt,
		})
		.from(documentTemplate)
		.leftJoin(user, eq(documentTemplate.authorId, user.id))
		.orderBy(desc(documentTemplate.updatedAt));
});

const getDocumentTemplateHandler = pub
	.input(getDocumentTemplateInput)
	.handler(async ({ context, input }) => {
		const [templateData] = await context.db
			.select({
				author: {
					email: user.email,
					id: user.id,
					name: user.name,
				},
				authorId: documentTemplate.authorId,
				category: documentTemplate.category,
				createdAt: documentTemplate.createdAt,
				fieldDefinitions: documentTemplate.fieldDefinitions,
				id: documentTemplate.id,
				title: documentTemplate.title,
				updatedAt: documentTemplate.updatedAt,
			})
			.from(documentTemplate)
			.leftJoin(user, eq(documentTemplate.authorId, user.id))
			.where(eq(documentTemplate.id, input.id))
			.limit(1);

		return templateData ?? null;
	});

const getDocumentTemplatePdfHandler = pub
	.input(getDocumentTemplateInput)
	.handler(async ({ context, input }) => {
		const [templateData] = await context.db
			.select({
				id: documentTemplate.id,
				pdfBytes: documentTemplate.pdfBytes,
			})
			.from(documentTemplate)
			.where(eq(documentTemplate.id, input.id))
			.limit(1);

		if (!templateData) {
			return null;
		}

		return {
			id: templateData.id,
			pdfBase64: encodePdfBase64(templateData.pdfBytes),
		};
	});

const createDocumentTemplateHandler = authed
	.input(createDocumentTemplateInput)
	.handler(async ({ context, input }) => {
		const { normalizedFieldDefinitions } = ensureValidFieldDefinitions(
			input.fieldDefinitions,
		);
		const pdfBytes = decodePdfBase64(input.pdfBase64);

		const [createdTemplate] = await context.db
			.insert(documentTemplate)
			.values({
				authorId: context.session.user.id,
				category: input.category.trim(),
				fieldDefinitions: normalizedFieldDefinitions,
				pdfBytes,
				title: input.title.trim(),
				updatedAt: new Date(),
			})
			.returning({
				authorId: documentTemplate.authorId,
				category: documentTemplate.category,
				createdAt: documentTemplate.createdAt,
				id: documentTemplate.id,
				title: documentTemplate.title,
				updatedAt: documentTemplate.updatedAt,
			});

		if (!createdTemplate) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: "Dokument konnte nicht erstellt werden.",
			});
		}

		return createdTemplate;
	});

const updateDocumentTemplateHandler = authed
	.input(updateDocumentTemplateInput)
	.handler(async ({ context, input }) => {
		const { normalizedFieldDefinitions } = ensureValidFieldDefinitions(
			input.fieldDefinitions,
		);

		const [existingTemplate] = await context.db
			.select({
				authorId: documentTemplate.authorId,
				pdfBytes: documentTemplate.pdfBytes,
			})
			.from(documentTemplate)
			.where(eq(documentTemplate.id, input.id))
			.limit(1);

		if (!existingTemplate) {
			throw new ORPCError("NOT_FOUND", {
				message: "Dokument nicht gefunden.",
			});
		}

		if (existingTemplate.authorId !== context.session.user.id) {
			throw new ORPCError("FORBIDDEN", {
				message: "Nur der Autor darf dieses Dokument bearbeiten.",
			});
		}

		const hasPdfReplacement = Boolean(input.pdfBase64);
		const pdfBytes = hasPdfReplacement
			? decodePdfBase64(input.pdfBase64 ?? "")
			: existingTemplate.pdfBytes;

		const [updatedTemplate] = await context.db
			.update(documentTemplate)
			.set({
				category: input.category.trim(),
				fieldDefinitions: normalizedFieldDefinitions,
				pdfBytes,
				title: input.title.trim(),
				updatedAt: new Date(),
			})
			.where(
				and(
					eq(documentTemplate.id, input.id),
					eq(documentTemplate.authorId, context.session.user.id),
				),
			)
			.returning({
				authorId: documentTemplate.authorId,
				category: documentTemplate.category,
				createdAt: documentTemplate.createdAt,
				id: documentTemplate.id,
				title: documentTemplate.title,
				updatedAt: documentTemplate.updatedAt,
			});

		if (!updatedTemplate) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: "Dokument konnte nicht aktualisiert werden.",
			});
		}

		return updatedTemplate;
	});

const getDocumentTemplateEditorContextHandler = authed.handler(async ({ context }) => {
	const userId = context.session.user.id;
	const limit = MAX_CATEGORY_SUGGESTIONS;
	const categorySuggestions: string[] = [];
	const seen = new Set<string>();

	const authoredCategories = await context.db
		.select({ category: documentTemplate.category })
		.from(documentTemplate)
		.where(eq(documentTemplate.authorId, userId))
		.groupBy(documentTemplate.category)
		.orderBy(desc(count()))
		.limit(limit);

	addCategories(
		categorySuggestions,
		seen,
		authoredCategories.map((item) => item.category),
		limit,
	);

	if (categorySuggestions.length < limit) {
		const allCategories = await context.db
			.select({ category: documentTemplate.category })
			.from(documentTemplate)
			.groupBy(documentTemplate.category)
			.orderBy(desc(count()))
			.limit(limit);

		addCategories(
			categorySuggestions,
			seen,
			allCategories.map((item) => item.category),
			limit,
		);
	}

	return {
		categorySuggestions,
	};
});

export const documentsHandler = {
	ocrToMarkdown: ocrToMarkdownHandler,
	parseForm: parseFormHandler,
	templates: {
		create: createDocumentTemplateHandler,
		editorContext: getDocumentTemplateEditorContextHandler,
		get: getDocumentTemplateHandler,
		getPdf: getDocumentTemplatePdfHandler,
		list: listDocumentTemplatesHandler,
		update: updateDocumentTemplateHandler,
	},
};
