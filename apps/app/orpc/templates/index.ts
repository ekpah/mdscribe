import { ORPCError, type } from "@orpc/server";
import { and, count, desc, eq, favourites, or, sql, template, user } from "@repo/database";
import type { Database, Template } from "@repo/database";
import { env } from "@repo/env";
import { validateMarkdocTagContracts } from "@repo/markdoc-md/parse/validate-markdoc-tag-contracts";
import { VoyageAIClient } from "voyageai";
import { z } from "zod";

import type { Session } from "@/lib/auth-types";
import { resolveProductEntitlements } from "@/lib/product-entitlements";
import { USER_MESSAGES } from "@/lib/user-messages";
import { authed, pub } from "@/orpc";
import { getOptionalAuthSession } from "@/orpc/middlewares/auth";

const templateVisibilitySchema = z.enum(["public", "private"]);
type TemplateVisibility = z.infer<typeof templateVisibilitySchema>;

const voyageClient = new VoyageAIClient({
	apiKey: env.VOYAGE_API_KEY as string,
});

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
// Embedding Generation
// ============================================================================

const generateEmbeddings = async (
	content: string,
	title: string,
	category: string,
): Promise<{ embedding: number[] }> => {
	const contentWithMetadata = `---
title: ${title}
category: ${category}
---

${content}`;
	const embedding = await voyageClient
		.embed({
			input: contentWithMetadata,
			model: "voyage-3-large",
		})
		.then((res) => res.data?.[0].embedding ?? []);

	return { embedding };
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
	name: z.string().min(1, "Name is required"),
	visibility: templateVisibilitySchema.default("public"),
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

/** Search every template visible to the current user using PostgreSQL full-text ranking. */
const searchTemplatesHandler = pub.input(lexicalSearchInput).handler(async ({ context, input }) => {
	const userId = await getOptionalUserId(context);
	const document = sql`setweight(to_tsvector('german', coalesce(${template.title}, '')), 'A') || setweight(to_tsvector('german', coalesce(${template.category}, '')), 'B') || setweight(to_tsvector('german', coalesce(${template.content}, '')), 'D')`;
	const query = sql`websearch_to_tsquery('german', ${input.query})`;
	const rank = sql<number>`ts_rank_cd(${document}, ${query}, 32)`;

	return context.db
		.select({
			category: template.category,
			id: template.id,
			rank,
			title: template.title,
			updatedAt: template.updatedAt,
		})
		.from(template)
		.where(and(visibleTemplateWhere(userId), sql`${document} @@ ${query}`))
		.orderBy(desc(rank), desc(template.updatedAt), template.id)
		.limit(LEXICAL_SEARCH_LIMIT);
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
				embedding: template.embedding,
				examples: template.examples,
				id: template.id,
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
		const { embedding } = await generateEmbeddings(input.content, input.name, input.category);
		const examples = input.examples.map((example) => example.trim());

		return context.db.transaction(async (tx) => {
			const result = await tx
				.insert(template)
				.values({
					authorId: context.session.user.id,
					category: input.category,
					content: input.content,
					embedding,
					examples,
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
		const { embedding } = await generateEmbeddings(input.content, input.name, input.category);
		const examples = input.examples.map((example) => example.trim());

		return context.db.transaction(async (tx) => {
			const result = await tx
				.update(template)
				.set({
					category: input.category,
					content: input.content,
					embedding,
					examples,
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
