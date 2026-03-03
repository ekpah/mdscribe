import { type } from "@orpc/server";
import {
	and,
	asc,
	count,
	desc,
	eq,
	favourites,
	sql,
	template,
	templateExample,
	user,
	type Template,
	type TemplateExample,
	type User,
} from "@repo/database";
import { env } from "@repo/env";
import { VoyageAIClient } from "voyageai";
import { z } from "zod";

import { authed, pub } from "@/orpc";

const voyageClient = new VoyageAIClient({
	apiKey: env.VOYAGE_API_KEY as string,
});

// Helper: Count how many users have favourited a template
const favouriteCount = (templateId: typeof template.id) =>
	sql<number>`(SELECT ${count()} FROM ${favourites} WHERE ${favourites.templateId} = ${templateId})`.as(
		"favouriteCount",
	);

// ============================================================================
// Types
// ============================================================================

type TemplateWithRelations = Template & {
	favouriteOf: Array<{ id: string }>;
	examples: TemplateExampleSummary[];
	author: User;
	_count: { favouriteOf: number };
};

type TemplateExampleSummary = Pick<TemplateExample, "id" | "content">;

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

const buildTemplateExampleRows = (templateId: string, examples: string[]) =>
	examples.map((example) => ({
		templateId,
		content: example,
	}));

// ============================================================================
// Input Schemas
// ============================================================================

const getTemplateInput = z.object({
	id: z.string(),
});

const createTemplateInput = z.object({
	category: z.string().min(1, "Category is required"),
	name: z.string().min(1, "Name is required"),
	content: z.string(),
	examples: z
		.array(z.string().trim().min(1, "Example content is required"))
		.max(10, "A maximum of 10 examples is allowed")
		.default([]),
});

const updateTemplateInput = z.object({
	id: z.string(),
	category: z.string().min(1, "Category is required"),
	name: z.string().min(1, "Name is required"),
	content: z.string(),
	examples: z
		.array(z.string().trim().min(1, "Example content is required"))
		.max(10, "A maximum of 10 examples is allowed")
		.default([]),
});

const favouriteInput = z.object({
	templateId: z.string(),
});

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

// ============================================================================
// Public Handlers
// ============================================================================

/**
 * List all templates (public)
 */
const listTemplatesHandler = pub.handler(async ({ context }) => {
	const templates = await context.db
		.select({
			id: template.id,
			title: template.title,
			category: template.category,
			content: template.content,
			authorId: template.authorId,
			updatedAt: template.updatedAt,
			embedding: template.embedding,
			_count: {
				favouriteOf: favouriteCount(template.id),
			},
		})
		.from(template);

	return templates;
});

/**
 * Get a single template by ID (public)
 */
const getTemplateHandler = pub
	.input(getTemplateInput)
	.output(type<TemplateWithRelations | null>())
	.handler(async ({ context, input }) => {
		// Get template with author
		const [templateData] = await context.db
			.select({
				id: template.id,
				title: template.title,
				category: template.category,
				content: template.content,
				authorId: template.authorId,
				updatedAt: template.updatedAt,
				embedding: template.embedding,
				author: {
					id: user.id,
					name: user.name,
					email: user.email,
					emailVerified: user.emailVerified,
					image: user.image,
					createdAt: user.createdAt,
					updatedAt: user.updatedAt,
					stripeCustomerId: user.stripeCustomerId,
				},
			})
			.from(template)
			.leftJoin(user, eq(template.authorId, user.id))
			.where(eq(template.id, input.id))
			.limit(1);

		if (!templateData) {
			return null;
		}

		const [favouriteUsers, countResult, examples] = await Promise.all([
			context.db
				.select({ id: favourites.userId })
				.from(favourites)
				.where(eq(favourites.templateId, input.id)),
			context.db
				.select({ count: count() })
				.from(favourites)
				.where(eq(favourites.templateId, input.id))
				.then((result) => result[0]),
			context.db
				.select({
					id: templateExample.id,
					content: templateExample.content,
				})
				.from(templateExample)
				.where(eq(templateExample.templateId, input.id))
				.orderBy(asc(templateExample.createdAt)),
		]);

		return {
			...templateData,
			favouriteOf: favouriteUsers,
			examples,
			author: templateData.author as User,
			_count: { favouriteOf: Number(countResult?.count ?? 0) },
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
		.select({
			id: template.id,
			title: template.title,
			category: template.category,
			content: template.content,
			authorId: template.authorId,
			updatedAt: template.updatedAt,
			embedding: template.embedding,
			_count: {
				favouriteOf: favouriteCount(template.id),
			},
		})
		.from(template)
		.innerJoin(favourites, eq(favourites.templateId, template.id))
		.where(eq(favourites.userId, context.session.user.id))
		.orderBy(desc(template.updatedAt));

	return favoriteTemplates;
});

/**
 * Get templates authored by the current user
 */
const getAuthoredHandler = authed.handler(async ({ context }) => {
	const userTemplates = await context.db
		.select({
			id: template.id,
			title: template.title,
			category: template.category,
			content: template.content,
			authorId: template.authorId,
			updatedAt: template.updatedAt,
			embedding: template.embedding,
			_count: {
				favouriteOf: favouriteCount(template.id),
			},
		})
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
			.where(eq(favourites.userId, userId))
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

	return {
		categorySuggestions,
		canEditSource: context.session.user.email === env.ADMIN_EMAIL,
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
		const { embedding } = await generateEmbeddings(
			input.content,
			input.name,
			input.category,
		);
		const examples = input.examples.map((example) => example.trim());

		return context.db.transaction(async (tx) => {
			const result = await tx
				.insert(template)
				.values({
					category: input.category,
					title: input.name,
					content: input.content,
					authorId: context.session.user.id,
					updatedAt: new Date(),
					embedding: embedding,
				})
				.returning();

			const newTemplate = result[0];
			if (!newTemplate) {
				throw new Error("Failed to create template");
			}

			if (examples.length > 0) {
				await tx
					.insert(templateExample)
					.values(buildTemplateExampleRows(newTemplate.id, examples));
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
		const { embedding } = await generateEmbeddings(
			input.content,
			input.name,
			input.category,
		);
		const examples = input.examples.map((example) => example.trim());

		return context.db.transaction(async (tx) => {
			const result = await tx
				.update(template)
				.set({
					category: input.category,
					title: input.name,
					content: input.content,
					updatedAt: new Date(),
					embedding: embedding,
				})
				.where(
					and(
						eq(template.id, input.id),
						eq(template.authorId, context.session.user.id),
					),
				)
				.returning();

			const updatedTemplate = result[0];
			if (!updatedTemplate) {
				throw new Error("Failed to update template or template not found");
			}

			await tx
				.delete(templateExample)
				.where(eq(templateExample.templateId, updatedTemplate.id));

			if (examples.length > 0) {
				await tx
					.insert(templateExample)
					.values(buildTemplateExampleRows(updatedTemplate.id, examples));
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
const addFavouriteHandler = authed
	.input(favouriteInput)
	.handler(async ({ context, input }) => {
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
const removeFavouriteHandler = authed
	.input(favouriteInput)
	.handler(async ({ context, input }) => {
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
	// Public
	list: listTemplatesHandler,
	get: getTemplateHandler,
	// Authenticated - Read
	favourites: getFavouritesHandler,
	authored: getAuthoredHandler,
	editorContext: getEditorContextHandler,
	// Authenticated - CRUD
	create: createTemplateHandler,
	update: updateTemplateHandler,
	// Authenticated - Favourites
	addFavourite: addFavouriteHandler,
	removeFavourite: removeFavouriteHandler,
};
