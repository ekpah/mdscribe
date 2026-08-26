import { ORPCError, type } from "@orpc/server";
import {
	aiScribeFormConfig,
	and,
	count,
	desc,
	eq,
	favourites,
	or,
	sql,
	template,
	user,
} from "@repo/database";
import type { Database, Template } from "@repo/database";
import { validateMarkdocTagContracts } from "markdoc-md/parse";
import { z } from "zod";

import type { Session } from "@/lib/auth-types";
import { resolveProductEntitlements } from "@/lib/product-entitlements";
import { createTemplateFuse } from "@/lib/template-search";
import { USER_MESSAGES } from "@/lib/user-messages";
import { authed, pub } from "@/orpc";
import { getOptionalAuthSession } from "@/orpc/middlewares/auth";

const templateVisibilitySchema = z.enum(["public", "private"]);
type TemplateVisibility = z.infer<typeof templateVisibilitySchema>;

// Helper: Count how many users have favourited a template
const favouriteCount = (templateId: typeof template.id) =>
	sql<number>`(SELECT ${count()} FROM ${favourites} WHERE ${favourites.templateId} = ${templateId})`.as(
		"favouriteCount",
	);

const templateListSelection = {
	_count: {
		favouriteOf: favouriteCount(template.id),
	},
	authorId: template.authorId,
	category: template.category,
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

type TemplateWithRelations = Template & {
	favouriteOf: { id: string }[];
	author: TemplateAuthorSummary | null;
	_count: { favouriteOf: number };
};

// ============================================================================
// Input Schemas
// ============================================================================

const getTemplateInput = z.object({
	id: z.string(),
});

const createTemplateInput = z.object({
	category: z.string().min(1, "Category is required"),
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
	category: z.string().min(1, "Category is required"),
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

const favouriteInput = z.object({
	templateId: z.string(),
});

const lexicalSearchInput = z.object({
	query: z.string().trim().min(1).max(200),
});

const LEXICAL_SEARCH_LIMIT = 20;

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

const visibleTemplateWhere = (userId?: string | null) =>
	userId
		? or(eq(template.visibility, "public"), eq(template.authorId, userId))
		: eq(template.visibility, "public");

const getOptionalUserId = async (context: unknown) => {
	const session = await getOptionalAuthSession((context as { session?: Session }).session);
	return session?.user.id ?? null;
};

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
	const diagnostics = validateMarkdocTagContracts(content);
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

/** Search every template visible to the current user using the shared fuzzy matcher. */
const searchTemplatesHandler = pub.input(lexicalSearchInput).handler(async ({ context, input }) => {
	const userId = await getOptionalUserId(context);
	const templates = await context.db
		.select({
			category: template.category,
			id: template.id,
			title: template.title,
			updatedAt: template.updatedAt,
		})
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
				category: template.category,
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

		const [favouriteUsers, countResult] = await Promise.all([
			userId
				? context.db
						.select({ id: favourites.userId })
						.from(favourites)
						.where(and(eq(favourites.templateId, input.id), eq(favourites.userId, userId)))
				: Promise.resolve([]),
			context.db
				.select({ count: count() })
				.from(favourites)
				.where(eq(favourites.templateId, input.id))
				.then((result) => result[0]),
		]);

		return {
			...templateData,
			_count: { favouriteOf: Number(countResult?.count ?? 0) },
			author: templateData.author?.id
				? {
						id: templateData.author.id,
						image: templateData.author.image,
						name: templateData.author.name,
					}
				: null,
			favouriteOf: favouriteUsers,
		};
	});

// ============================================================================
// Authenticated Handlers - Read Operations
// ============================================================================

/**
 * Get templates favourited by the current user
 */
const getFavouritesHandler = authed.handler(async ({ context }) => {
	const favoriteTemplates = await context.db
		.select(templateListSelection)
		.from(template)
		.innerJoin(favourites, eq(favourites.templateId, template.id))
		.where(
			and(
				eq(favourites.userId, context.session.user.id),
				visibleTemplateWhere(context.session.user.id),
			),
		)
		.orderBy(desc(template.updatedAt));

	return favoriteTemplates;
});

/**
 * Get templates authored by the current user
 */
const getAuthoredHandler = authed.handler(async ({ context }) => {
	const userTemplates = await context.db
		.select(templateListSelection)
		.from(template)
		.where(eq(template.authorId, context.session.user.id))
		.orderBy(desc(template.updatedAt))
		.limit(3);

	return userTemplates;
});

const getEditorContextHandler = authed.handler(async ({ context }) => {
	const userId = context.session.user.id;
	const limit = MAX_CATEGORY_SUGGESTIONS;
	const categorySuggestions: string[] = [];
	const seen = new Set<string>();

	const authoredCategories = await context.db
		.select({ category: template.category })
		.from(template)
		.where(eq(template.authorId, userId))
		.groupBy(template.category)
		.orderBy(desc(count()))
		.limit(limit);

	addCategories(
		categorySuggestions,
		seen,
		authoredCategories.map((item) => item.category),
		limit,
	);

	if (categorySuggestions.length < limit) {
		const favouriteCategories = await context.db
			.select({ category: template.category })
			.from(favourites)
			.innerJoin(template, eq(favourites.templateId, template.id))
			.where(and(eq(favourites.userId, userId), visibleTemplateWhere(userId)))
			.groupBy(template.category)
			.orderBy(desc(count()))
			.limit(limit);

		addCategories(
			categorySuggestions,
			seen,
			favouriteCategories.map((item) => item.category),
			limit,
		);
	}

	if (categorySuggestions.length < limit) {
		const allCategories = await context.db
			.select({ category: template.category })
			.from(template)
			.where(eq(template.visibility, "public"))
			.groupBy(template.category)
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
		canCreatePrivateTemplates: entitlements.canCreatePrivateTemplates,
		canEditSource: context.auth.isAdmin,
		categorySuggestions,
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
					category: input.category,
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
					category: input.category,
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

/**
 * Delete an authored template and every AI template based on it. Deleting the
 * AI templates resets referencing workspace slots to their default via the
 * existing ON DELETE SET NULL foreign keys.
 */
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

		const deletedAiTemplates = await tx
			.delete(aiScribeFormConfig)
			.where(eq(aiScribeFormConfig.templateId, input.id))
			.returning({ id: aiScribeFormConfig.id });

		await tx.delete(template).where(eq(template.id, input.id));

		return {
			deletedAiTemplateCount: deletedAiTemplates.length,
			success: true,
		};
	}),
);

// ============================================================================
// Authenticated Handlers - Favourite Operations
// ============================================================================

/**
 * Add a template to favourites
 */
const addFavouriteHandler = authed.input(favouriteInput).handler(async ({ context, input }) => {
	const [visibleTemplate] = await context.db
		.select({ id: template.id })
		.from(template)
		.where(and(eq(template.id, input.templateId), visibleTemplateWhere(context.session.user.id)))
		.limit(1);

	if (!visibleTemplate) {
		throw new ORPCError("NOT_FOUND", {
			message: "Textbaustein nicht gefunden.",
		});
	}

	await context.db
		.insert(favourites)
		.values({
			templateId: input.templateId,
			userId: context.session.user.id,
		})
		.onConflictDoNothing();

	return { success: true };
});

/**
 * Remove a template from favourites
 */
const removeFavouriteHandler = authed.input(favouriteInput).handler(async ({ context, input }) => {
	await context.db
		.delete(favourites)
		.where(
			and(
				eq(favourites.templateId, input.templateId),
				eq(favourites.userId, context.session.user.id),
			),
		);

	return { success: true };
});

// ============================================================================
// Exports
// ============================================================================

export const templatesHandler = {
	addFavourite: addFavouriteHandler,
	authored: getAuthoredHandler,
	// Authenticated - CRUD
	create: createTemplateHandler,
	delete: deleteTemplateHandler,
	editorContext: getEditorContextHandler,
	// Authenticated - Read
	favourites: getFavouritesHandler,
	// Public
	get: getTemplateHandler,
	list: listTemplatesHandler,
	// Authenticated - Favourites
	removeFavourite: removeFavouriteHandler,
	search: searchTemplatesHandler,
	update: updateTemplateHandler,
};
