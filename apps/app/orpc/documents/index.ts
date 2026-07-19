import { ORPCError, type } from "@orpc/server";
import { and, count, desc, documentTemplate, eq, or, usageEvent, user } from "@repo/database";
import type { Database } from "@repo/database";
import { generateObject } from "ai";
import { z } from "zod";

import {
	documentDefinitionSchema,
	MAX_PDF_BASE64_LENGTH,
	MAX_PDF_UPLOAD_BYTES,
	normalizeDocumentDefinition,
	parsePDFFormFields,
} from "@/app/documents/_lib";
import type { DocumentDefinition } from "@/app/documents/_lib";
import {
	validateDocumentDefinitionAgainstPdfFields,
	validateDocumentDefinitionPreservesPdfFields,
} from "@/app/documents/_lib/pdf-definition-validation";
import type { Session } from "@/lib/auth-types";
import { resolveProductEntitlements } from "@/lib/product-entitlements";
import { buildUsageEventData, extractOpenRouterUsage } from "@/lib/usage-logging";
import type { StandardUsage } from "@/lib/usage-logging";
import { USER_MESSAGES } from "@/lib/user-messages";
import { authed, pub } from "@/orpc";
import { requiredAdminMiddleware } from "@/orpc/middlewares/admin";
import { getOptionalAuthSession } from "@/orpc/middlewares/auth";
import { scribeEntitlementsMiddleware } from "@/orpc/middlewares/entitlements";
import { enforceScribeUsageLimit } from "@/orpc/scribe/handlers/usage-limit";
import {
	buildProviderOptions,
	resolveGenerationStrategy,
	resolveProviderModel,
} from "@/orpc/scribe/providers";

import { pdfDocumentConfigs } from "./config";
import type { DocumentInputField } from "./config";

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

const enhancedDocumentDefinitionSchema = z.object({
	fieldDefinitions: documentDefinitionSchema,
});

const MAX_DOCUMENT_TITLE_LENGTH = 200;
const MAX_DOCUMENT_CATEGORY_LENGTH = 100;
const MAX_AI_INPUT_FIELDS = 2000;
const MAX_AI_PROMPT_CHARACTERS = 300_000;
const BASE64_PATTERN = /^(?:[A-Za-z\d+/]{4})*(?:[A-Za-z\d+/]{2}==|[A-Za-z\d+/]{3}=)?$/;

const pdfBase64Schema = z
	.string()
	.min(1, "PDF content is required")
	.max(MAX_PDF_BASE64_LENGTH, `PDF darf höchstens ${MAX_PDF_UPLOAD_BYTES} Bytes groß sein.`)
	.regex(BASE64_PATTERN, "PDF-Inhalt ist nicht gültig Base64-kodiert.");

const documentInputFieldSchema = z.object({
	description: z.string().optional(),
	label: z.string().min(1).max(500),
	options: z.array(z.string().max(500)).max(500).optional(),
	type: z.enum(["string", "number", "date", "switch", "boolean"]).optional(),
	unit: z.string().optional(),
});

const documentFieldMappingSchema = z.object({
	description: z.string().optional(),
	fieldName: z.string().min(1).max(500),
	inputKind: z.enum(["boolean", "choice", "text"]),
	label: z.string().min(1).max(500),
	options: z.array(z.string().max(500)).max(500).optional(),
	pdfType: z
		.enum(["text", "multiline", "dropdown", "checkbox", "radio", "unsupported"])
		.optional(),
});

const parseFormInput = z.object({
	fieldMappings: z.array(documentFieldMappingSchema).max(MAX_AI_INPUT_FIELDS).optional(),
	fileBase64: pdfBase64Schema,
	inputFields: z.array(documentInputFieldSchema).max(MAX_AI_INPUT_FIELDS).optional(),
	model: z.string().min(1).optional(),
	providerId: z.string().min(1).optional(),
});

const enhanceDefinitionInput = z.object({
	fieldDefinitions: documentDefinitionSchema,
	fileBase64: pdfBase64Schema,
});

const toDocumentInputFieldType = (
	inputKind: z.infer<typeof documentFieldMappingSchema>["inputKind"],
): DocumentInputField["type"] => {
	if (inputKind === "text") {
		return "string";
	}
	if (inputKind === "boolean") {
		return "boolean";
	}
	return "switch";
};

const adminDocumentProcedure = authed.use(requiredAdminMiddleware);

const documentTemplateVisibilitySchema = z.enum(["public", "private"]);
type DocumentTemplateVisibility = z.infer<typeof documentTemplateVisibilitySchema>;

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
	category: z.string().min(1, "Category is required").max(MAX_DOCUMENT_CATEGORY_LENGTH),
	fieldDefinitions: documentDefinitionSchema,
	pdfBase64: pdfBase64Schema,
	title: z.string().min(1, "Title is required").max(MAX_DOCUMENT_TITLE_LENGTH),
	visibility: documentTemplateVisibilitySchema.default("public"),
});

const updateDocumentTemplateInput = z.object({
	category: z.string().min(1, "Category is required").max(MAX_DOCUMENT_CATEGORY_LENGTH),
	fieldDefinitions: documentDefinitionSchema,
	id: z.string().min(1),
	pdfBase64: pdfBase64Schema.optional(),
	title: z.string().min(1, "Title is required").max(MAX_DOCUMENT_TITLE_LENGTH),
	visibility: documentTemplateVisibilitySchema.default("public"),
});

const getDocumentTemplateInput = z.object({
	id: z.string(),
});

const decodePdfBase64 = (value: string): Uint8Array => {
	const bytes = new Uint8Array(Buffer.from(value, "base64"));
	if (bytes.byteLength > MAX_PDF_UPLOAD_BYTES) {
		throw new ORPCError("BAD_REQUEST", {
			message: `PDF darf höchstens ${MAX_PDF_UPLOAD_BYTES} Bytes groß sein.`,
		});
	}
	return bytes;
};

const encodePdfBase64 = (value: Uint8Array): string => Buffer.from(value).toString("base64");

const ensureValidFieldDefinitions = (
	fieldDefinitions: DocumentDefinition,
): {
	normalizedFieldDefinitions: DocumentDefinition;
} => {
	try {
		return { normalizedFieldDefinitions: normalizeDocumentDefinition(fieldDefinitions) };
	} catch (error) {
		throw new ORPCError("BAD_REQUEST", {
			message:
				error instanceof Error && error.message
					? error.message
					: "Die Felddefinitionen ergeben kein gültiges Inputs-Format.",
		});
	}
};

const ensureDefinitionMatchesPdf = async (
	pdfBytes: Uint8Array,
	definition: DocumentDefinition,
): Promise<void> => {
	try {
		const { fields } = await parsePDFFormFields(pdfBytes);
		validateDocumentDefinitionAgainstPdfFields(definition, fields);
	} catch (error) {
		throw new ORPCError("BAD_REQUEST", {
			message:
				error instanceof Error
					? error.message
					: "PDF und Felddefinitionen konnten nicht geprüft werden.",
		});
	}
};

const visibleDocumentTemplateWhere = (userId?: string | null) =>
	userId
		? or(eq(documentTemplate.visibility, "public"), eq(documentTemplate.authorId, userId))
		: eq(documentTemplate.visibility, "public");

const getOptionalUserId = async (context: unknown) => {
	const session = await getOptionalAuthSession((context as { session?: Session }).session);
	return session?.user.id ?? null;
};

const ensureCanSaveDocumentVisibility = async ({
	db,
	userId,
	visibility,
}: {
	db: Database;
	userId: string;
	visibility: DocumentTemplateVisibility;
}) => {
	if (visibility === "public") {
		return;
	}

	const entitlements = await resolveProductEntitlements({ db, userId });
	if (!entitlements.canCreatePrivateDocuments) {
		throw new ORPCError("FORBIDDEN", {
			message: USER_MESSAGES.privateDocumentRequiresPlus,
		});
	}
};

/**
 * Parse and enhance PDF form fields using AI.
 */
const parseFormHandler = adminDocumentProcedure
	.input(type<z.infer<typeof parseFormInput>>())
	.handler(async ({ input, context }) => {
		const parsed = parseFormInput.parse(input);
		const { fileBase64 } = parsed;
		const fieldMappings = parsed.fieldMappings ?? [];
		const inputFields =
			parsed.inputFields ??
			fieldMappings.map(
				(mapping) =>
					({
						description: mapping.description,
						label: mapping.label,
						options: mapping.options,
						type: toDocumentInputFieldType(mapping.inputKind),
					}) satisfies DocumentInputField,
			);
		const config = pdfDocumentConfigs.parseForm;

		const bytes = decodePdfBase64(fileBase64);
		const promptMessages = config.prompt({ fieldMappings, inputFields });
		const promptText = promptMessages[0].content;
		let modelSelection: Awaited<ReturnType<typeof resolveGenerationStrategy>>["generation"];
		try {
			const { providerId } = parsed;
			if (providerId || parsed.model) {
				if (!providerId || !parsed.model) {
					throw new Error("providerId und model müssen gemeinsam angegeben werden");
				}
				modelSelection = {
					defaultTemperature: null,
					model: await resolveProviderModel(providerId, parsed.model, context.db),
					reasoningEffort: "none",
					slot: "file-image",
				};
			} else {
				const strategy = await resolveGenerationStrategy(context.db, {
					hasFiles: true,
				});
				modelSelection =
					strategy.files?.mode === "preprocess" ? strategy.files.selection : strategy.generation;
			}
		} catch (error) {
			const details = error instanceof Error ? error.message : "Unbekannter Fehler";
			throw new ORPCError("BAD_REQUEST", {
				message: `Kein kompatibles KI-Modell für PDF-Analyse verfügbar. (${details})`,
			});
		}

		let result: Awaited<ReturnType<typeof generateObject>>;
		const requestStartedAt = Date.now();
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
				model: modelSelection.model.model,
				providerOptions: buildProviderOptions({
					includeUsage: true,
					model: modelSelection.model,
					reasoningEffort: modelSelection.reasoningEffort,
					userId: context.session.user.id,
				}),
				schema: enhancedFieldMappingSchema,
				temperature:
					config.modelConfig.temperature ?? modelSelection.defaultTemperature ?? undefined,
			});
		} catch (error) {
			const details = error instanceof Error ? error.message : "Unbekannter Fehler";
			throw new ORPCError("BAD_REQUEST", {
				message: `Eingaben konnten nicht mit KI optimiert werden. (${details})`,
			});
		}
		const timeToCompletionMs = Date.now() - requestStartedAt;

		const { object, usage } = result;
		const openRouterUsage = modelSelection.model.isOpenRouter
			? extractOpenRouterUsage(
					(result as { providerMetadata?: Record<string, unknown> }).providerMetadata,
				)
			: undefined;

		await context.db.insert(usageEvent).values(
			buildUsageEventData({
				inputData: { fieldCount: fieldMappings.length },
				metadata: {
					promptName: config.promptName,
				},
				model: modelSelection.model.modelName,
				name: "ai_pdf_form_parsing",
				openRouterUsage,
				standardUsage: usage as StandardUsage,
				timing: { timeToCompletionMs },
				userId: context.session.user.id,
			}),
		);

		return object;
	});

const enhanceDefinitionHandler = authed
	.use(scribeEntitlementsMiddleware)
	.input(type<z.infer<typeof enhanceDefinitionInput>>())
	.handler(async ({ input, context }) => {
		const parsed = enhanceDefinitionInput.parse(input);
		const { normalizedFieldDefinitions: currentDefinition } = ensureValidFieldDefinitions(
			parsed.fieldDefinitions,
		);
		const pdfBytes = decodePdfBase64(parsed.fileBase64);
		const { fields } = await parsePDFFormFields(pdfBytes).catch((error: unknown) => {
			const message = error instanceof Error ? error.message : USER_MESSAGES.unknownError;
			throw new ORPCError("BAD_REQUEST", { message });
		});

		try {
			validateDocumentDefinitionPreservesPdfFields(currentDefinition, currentDefinition, fields);
			validateDocumentDefinitionAgainstPdfFields(currentDefinition, fields);
		} catch (error) {
			const message = error instanceof Error ? error.message : USER_MESSAGES.unknownError;
			throw new ORPCError("BAD_REQUEST", { message });
		}
		const { entitlements } = await enforceScribeUsageLimit({
			db: context.db,
			entitlements: context.entitlements.scribe,
			session: context.session,
		});

		const config = pdfDocumentConfigs.enhanceDefinition;
		const promptText = config.prompt({ definition: currentDefinition, pdfFields: fields })[0]
			.content;
		if (promptText.length > MAX_AI_PROMPT_CHARACTERS) {
			throw new ORPCError("BAD_REQUEST", {
				message: USER_MESSAGES.documentEditor.aiDefinitionTooLarge,
			});
		}

		let modelSelection: Awaited<ReturnType<typeof resolveGenerationStrategy>>["generation"];
		try {
			const strategy = await resolveGenerationStrategy(context.db, { hasFiles: true });
			modelSelection =
				strategy.files?.mode === "preprocess" ? strategy.files.selection : strategy.generation;
		} catch (error) {
			const details = error instanceof Error ? error.message : USER_MESSAGES.unknownError;
			throw new ORPCError("BAD_REQUEST", {
				message: `${USER_MESSAGES.documentEditor.aiModelUnavailable} (${details})`,
			});
		}

		const requestStartedAt = Date.now();
		const result = await generateObject({
			experimental_telemetry: { isEnabled: true },
			messages: [
				{
					content: [{ text: promptText, type: "text" }],
					role: "user",
				},
				{
					content: [{ data: pdfBytes, mediaType: "application/pdf", type: "file" }],
					role: "user",
				},
			],
			model: modelSelection.model.model,
			output: "no-schema",
			providerOptions: buildProviderOptions({
				includeUsage: true,
				model: modelSelection.model,
				reasoningEffort: modelSelection.reasoningEffort,
				userId: context.session.user.id,
				zdr: entitlements.hasActiveSubscription,
			}),
			temperature: config.modelConfig.temperature ?? modelSelection.defaultTemperature ?? undefined,
		}).catch((error: unknown) => {
			const statusCode =
				typeof error === "object" &&
				error !== null &&
				"statusCode" in error &&
				typeof error.statusCode === "number"
					? error.statusCode
					: undefined;
			console.error("Document AI enhancement provider request failed", {
				message: error instanceof Error ? error.message : USER_MESSAGES.unknownError,
				model: modelSelection.model.modelName,
				providerProtocol: modelSelection.model.providerProtocol,
				statusCode,
			});
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: USER_MESSAGES.documentEditor.aiEnhancementFailed,
			});
		});

		const openRouterUsage = modelSelection.model.isOpenRouter
			? extractOpenRouterUsage(
					(result as { providerMetadata?: Record<string, unknown> }).providerMetadata,
				)
			: undefined;
		await context.db.insert(usageEvent).values(
			buildUsageEventData({
				inputData: {
					bindingCount: currentDefinition.bindings.length,
					inputCount: currentDefinition.inputs.length,
					pdfFieldCount: fields.length,
				},
				metadata: {
					promptName: config.promptName,
					zdrEnabled: entitlements.hasActiveSubscription,
				},
				model: modelSelection.model.modelName,
				name: "ai_pdf_document_enhancement",
				openRouterUsage,
				standardUsage: result.usage as StandardUsage,
				timing: { timeToCompletionMs: Date.now() - requestStartedAt },
				userId: context.session.user.id,
			}),
		);

		let fieldDefinitions: DocumentDefinition;
		try {
			const generated = enhancedDocumentDefinitionSchema.parse(result.object);
			fieldDefinitions = normalizeDocumentDefinition(generated.fieldDefinitions);
			validateDocumentDefinitionPreservesPdfFields(currentDefinition, fieldDefinitions, fields);
			validateDocumentDefinitionAgainstPdfFields(fieldDefinitions, fields);
		} catch (error) {
			const details = error instanceof Error ? error.message : USER_MESSAGES.unknownError;
			throw new ORPCError("BAD_REQUEST", {
				message: `${USER_MESSAGES.documentEditor.aiProposalInvalid} (${details})`,
			});
		}

		return { fieldDefinitions };
	});

const listDocumentTemplatesHandler = pub.handler(async ({ context }) => {
	const userId = await getOptionalUserId(context);
	return context.db
		.select({
			author: {
				id: user.id,
				name: user.name,
			},
			authorId: documentTemplate.authorId,
			category: documentTemplate.category,
			createdAt: documentTemplate.createdAt,
			id: documentTemplate.id,
			title: documentTemplate.title,
			updatedAt: documentTemplate.updatedAt,
			visibility: documentTemplate.visibility,
		})
		.from(documentTemplate)
		.leftJoin(user, eq(documentTemplate.authorId, user.id))
		.where(visibleDocumentTemplateWhere(userId))
		.orderBy(desc(documentTemplate.updatedAt));
});

const getDocumentTemplateHandler = pub
	.input(getDocumentTemplateInput)
	.handler(async ({ context, input }) => {
		const userId = await getOptionalUserId(context);
		const [templateData] = await context.db
			.select({
				author: {
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
				visibility: documentTemplate.visibility,
			})
			.from(documentTemplate)
			.leftJoin(user, eq(documentTemplate.authorId, user.id))
			.where(and(eq(documentTemplate.id, input.id), visibleDocumentTemplateWhere(userId)))
			.limit(1);

		return templateData ?? null;
	});

const getDocumentTemplatePdfHandler = pub
	.input(getDocumentTemplateInput)
	.handler(async ({ context, input }) => {
		const userId = await getOptionalUserId(context);
		const [templateData] = await context.db
			.select({
				id: documentTemplate.id,
				pdfBytes: documentTemplate.pdfBytes,
			})
			.from(documentTemplate)
			.where(and(eq(documentTemplate.id, input.id), visibleDocumentTemplateWhere(userId)))
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
		await ensureCanSaveDocumentVisibility({
			db: context.db,
			userId: context.session.user.id,
			visibility: input.visibility,
		});
		const { normalizedFieldDefinitions } = ensureValidFieldDefinitions(input.fieldDefinitions);
		const pdfBytes = decodePdfBase64(input.pdfBase64);
		await ensureDefinitionMatchesPdf(pdfBytes, normalizedFieldDefinitions);

		const [createdTemplate] = await context.db
			.insert(documentTemplate)
			.values({
				authorId: context.session.user.id,
				category: input.category.trim(),
				fieldDefinitions: normalizedFieldDefinitions,
				pdfBytes,
				title: input.title.trim(),
				updatedAt: new Date(),
				visibility: input.visibility,
			})
			.returning({
				authorId: documentTemplate.authorId,
				category: documentTemplate.category,
				createdAt: documentTemplate.createdAt,
				id: documentTemplate.id,
				title: documentTemplate.title,
				updatedAt: documentTemplate.updatedAt,
				visibility: documentTemplate.visibility,
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
		await ensureCanSaveDocumentVisibility({
			db: context.db,
			userId: context.session.user.id,
			visibility: input.visibility,
		});
		const { normalizedFieldDefinitions } = ensureValidFieldDefinitions(input.fieldDefinitions);

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
		await ensureDefinitionMatchesPdf(pdfBytes, normalizedFieldDefinitions);

		const [updatedTemplate] = await context.db
			.update(documentTemplate)
			.set({
				category: input.category.trim(),
				fieldDefinitions: normalizedFieldDefinitions,
				pdfBytes,
				title: input.title.trim(),
				updatedAt: new Date(),
				visibility: input.visibility,
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
				visibility: documentTemplate.visibility,
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
			.where(eq(documentTemplate.visibility, "public"))
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

	const entitlements = await resolveProductEntitlements({
		db: context.db,
		userId: context.session.user.id,
	});

	return {
		canCreatePrivateDocuments: entitlements.canCreatePrivateDocuments,
		categorySuggestions,
	};
});

export const documentsHandler = {
	enhanceDefinition: enhanceDefinitionHandler,
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
