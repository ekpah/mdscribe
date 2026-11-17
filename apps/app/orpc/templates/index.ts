import { ORPCError, type } from "@orpc/server";
import {
	aiDefaults,
	aiScribeFormConfig,
	aiScribeWorkspace,
	and,
	desc,
	eq,
	or,
	template,
	templateCollectionTemplate,
	user,
} from "@repo/database";
import type { Database, Template } from "@repo/database";
import { z } from "zod";

import { validateAppTemplate } from "@/features/template-tags/config";
import { templateAgentFlag } from "@/flags";
import { resolveProductEntitlements } from "@/lib/product-entitlements";
import { createTemplateFuse } from "@/lib/template-search";
import { USER_MESSAGES } from "@/lib/user-messages";
import { authed, pub } from "@/orpc";
import { getOptionalUserId } from "@/orpc/middlewares/auth";

const templateVisibilitySchema = z.enum(["public", "private"]);
type TemplateVisibility = z.infer<typeof templateVisibilitySchema>;

const templateListSelection = {
	authorId: template.authorId,
	id: template.id,
	title: template.title,
	updatedAt: template.updatedAt,
	visibility: template.visibility,
};

// ============================================================================
// Types
// ============================================================================

interface TemplateAuthorSummary {
	id: string;
	image: string | null;
	name: string | null;
}

type TemplateWithRelations = Omit<Template, "category"> & {
	author: TemplateAuthorSummary | null;
};

// ============================================================================
// Input Schemas
// ============================================================================

const getTemplateInput = z.object({
	id: z.string(),
});

const createTemplateInput = z.object({
	content: z.string(),
	examples: z
		.array(z.string().trim().min(1, "Example content is required"))
		.max(10, "A maximum of 10 examples is allowed")
		.default([]),
	information: z.string().max(10_000, "Information is too long").default(""),
	name: z.string().min(1, "Name is required"),
	visibility: templateVisibilitySchema.default("public"),
});

const updateTemplateInput = z.object({
	content: z.string(),
	examples: z
		.array(z.string().trim().min(1, "Example content is required"))
		.max(10, "A maximum of 10 examples is allowed")
		.default([]),
	id: z.string(),
	information: z.string().max(10_000, "Information is too long").default(""),
	name: z.string().min(1, "Name is required"),
	visibility: templateVisibilitySchema.default("public"),
});

const deleteTemplateInput = z.object({
	id: z.string(),
});

const lexicalSearchInput = z.object({
	query: z.string().trim().min(1).max(200),
});

const LEXICAL_SEARCH_LIMIT = 20;

const visibleTemplateWhere = (userId?: string | null) =>
	userId
		? or(eq(template.visibility, "public"), eq(template.authorId, userId))
		: eq(template.visibility, "public");

const ensureCanSaveTemplateVisibility = async ({
	db,
	userId,
	visibility,
}: {
	db: Database;
	userId: string;
	visibility: TemplateVisibility;
}) => {
	if (visibility === "public") {
		return;
	}

	const entitlements = await resolveProductEntitlements({ db, userId });
	if (!entitlements.canCreatePrivateTemplates) {
		throw new ORPCError("FORBIDDEN", {
			message: USER_MESSAGES.privateTemplateRequiresPlus,
		});
	}
};

const ensureValidTemplateContent = (content: string): void => {
	const diagnostics = validateAppTemplate(content);
	if (diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
		throw new ORPCError("BAD_REQUEST", {
			message: USER_MESSAGES.invalidTemplateTags,
		});
	}
};

// ============================================================================
// Public Handlers
// ============================================================================

/**
 * List all templates (public)
 */
const listTemplatesHandler = pub.handler(async ({ context }) => {
	const userId = await getOptionalUserId(context);
	const templates = await context.db
		.select(templateListSelection)
		.from(template)
		.where(visibleTemplateWhere(userId));

	return templates;
});

/** The templates of the admin-chosen AI Scribe collection, as offered on `/aiscribe`. */
const listAiScribeDefaultsHandler = pub.handler(async ({ context }) => {
	const userId = await getOptionalUserId(context);
	return context.db
		.select({ ...templateListSelection, content: template.content })
		.from(aiDefaults)
		.innerJoin(
			templateCollectionTemplate,
			eq(templateCollectionTemplate.collectionId, aiDefaults.aiScribeCollectionId),
		)
		.innerJoin(template, eq(templateCollectionTemplate.templateId, template.id))
		.where(and(eq(aiDefaults.id, "global"), visibleTemplateWhere(userId)))
		.orderBy(template.title);
});

/** Search every template visible to the current user using the shared fuzzy matcher. */
const searchTemplatesHandler = pub.input(lexicalSearchInput).handler(async ({ context, input }) => {
	const userId = await getOptionalUserId(context);
	const templates = await context.db
		.select({ id: template.id, title: template.title, updatedAt: template.updatedAt })
		.from(template)
		.where(visibleTemplateWhere(userId));

	return createTemplateFuse(templates)
		.search(input.query, { limit: LEXICAL_SEARCH_LIMIT })
		.map((result) => result.item);
});

/**
 * Get a single template by ID (public)
 */
const getTemplateHandler = pub
	.input(getTemplateInput)
	.output(type<TemplateWithRelations | null>())
	.handler(async ({ context, input }) => {
		const userId = await getOptionalUserId(context);
		// Get template with author
		const [templateData] = await context.db
			.select({
				author: {
					id: user.id,
					image: user.image,
					name: user.name,
				},
				authorId: template.authorId,
				content: template.content,
				examples: template.examples,
				id: template.id,
				information: template.information,
				title: template.title,
				updatedAt: template.updatedAt,
				visibility: template.visibility,
			})
			.from(template)
			.leftJoin(user, eq(template.authorId, user.id))
			.where(and(eq(template.id, input.id), visibleTemplateWhere(userId)))
			.limit(1);

		if (!templateData) {
			return null;
		}

		return {
			...templateData,
			author: templateData.author?.id
				? {
						id: templateData.author.id,
						image: templateData.author.image,
						name: templateData.author.name,
					}
				: null,
		};
	});

// ============================================================================
// Authenticated Handlers - Read Operations
// ============================================================================

/**
 * Get templates authored by the current user
 */
const authoredTemplatesInput = z
	.object({
		limit: z.number().int().min(1).max(100).optional(),
	})
	.default({});

const getAuthoredHandler = authed
	.input(authoredTemplatesInput)
	.handler(async ({ context, input }) => {
		const query = context.db
			.select(templateListSelection)
			.from(template)
			.where(eq(template.authorId, context.session.user.id))
			.orderBy(desc(template.updatedAt))
			.$dynamic();
		const userTemplates = await (input.limit ? query.limit(input.limit) : query);

		return userTemplates;
	});

const getEditorContextHandler = authed.handler(async ({ context }) => {
	const entitlements = await resolveProductEntitlements({
		db: context.db,
		userId: context.session.user.id,
	});

	return {
		canCreatePrivateTemplates: entitlements.canCreatePrivateTemplates,
		isTemplateAgentEnabled: await templateAgentFlag.run({
			identify: { isAdmin: context.auth.isAdmin },
		}),
	};
});

// ============================================================================
// Authenticated Handlers - CRUD Operations
// ============================================================================

/**
 * Create a new template
 */
const createTemplateHandler = authed
	.input(createTemplateInput)
	.handler(async ({ context, input }) => {
		await ensureCanSaveTemplateVisibility({
			db: context.db,
			userId: context.session.user.id,
			visibility: input.visibility,
		});
		ensureValidTemplateContent(input.content);
		const information = input.information.trim();
		const examples = input.examples.map((example) => example.trim());

		return context.db.transaction(async (tx) => {
			const result = await tx
				.insert(template)
				.values({
					authorId: context.session.user.id,
					content: input.content,
					examples,
					information,
					title: input.name,
					updatedAt: new Date(),
					visibility: input.visibility,
				})
				.returning();

			const [newTemplate] = result;
			if (!newTemplate) {
				throw new Error("Failed to create template");
			}

			return newTemplate;
		});
	});

/**
 * Update an existing template (only by author)
 */
const updateTemplateHandler = authed
	.input(updateTemplateInput)
	.handler(async ({ context, input }) => {
		await ensureCanSaveTemplateVisibility({
			db: context.db,
			userId: context.session.user.id,
			visibility: input.visibility,
		});
		ensureValidTemplateContent(input.content);
		const information = input.information.trim();
		const examples = input.examples.map((example) => example.trim());

		return context.db.transaction(async (tx) => {
			const result = await tx
				.update(template)
				.set({
					content: input.content,
					examples,
					information,
					title: input.name,
					updatedAt: new Date(),
					visibility: input.visibility,
				})
				.where(and(eq(template.id, input.id), eq(template.authorId, context.session.user.id)))
				.returning();

			const [updatedTemplate] = result;
			if (!updatedTemplate) {
				throw new Error("Failed to update template or template not found");
			}

			return updatedTemplate;
		});
	});

/** Delete an authored template. */
const deleteTemplateHandler = authed.input(deleteTemplateInput).handler(({ context, input }) =>
	context.db.transaction(async (tx) => {
		const ownedTemplate = await tx.query.template.findFirst({
			columns: { id: true },
			where: and(eq(template.id, input.id), eq(template.authorId, context.session.user.id)),
		});

		if (!ownedTemplate) {
			throw new ORPCError("NOT_FOUND", {
				message: "Textbaustein wurde nicht gefunden",
			});
		}

		await tx.delete(template).where(eq(template.id, input.id));
		// A template converted from an AI Vorlage or Brief-Baukasten shares its id;
		// drop the old entry too, so a later conversion cannot bring it back.
		await tx.delete(aiScribeFormConfig).where(eq(aiScribeFormConfig.id, input.id));
		await tx.delete(aiScribeWorkspace).where(eq(aiScribeWorkspace.id, input.id));
		return { success: true };
	}),
);

// ============================================================================
// Exports
// ============================================================================

export const templatesHandler = {
	// Public: the AI Scribe page's default templates
	aiScribeDefaults: listAiScribeDefaultsHandler,
	// Authenticated - Read
	authored: getAuthoredHandler,
	// Authenticated - CRUD
	create: createTemplateHandler,
	delete: deleteTemplateHandler,
	editorContext: getEditorContextHandler,
	// Public
	get: getTemplateHandler,
	list: listTemplatesHandler,
	search: searchTemplatesHandler,
	update: updateTemplateHandler,
};
