import { type } from "@orpc/server";
import {
	and,
	desc,
	eq,
	favourites,
	sql,
	template,
	user,
	type Template,
	type User,
} from "@repo/database";
import { env } from "@repo/env";
import { VoyageAIClient } from "voyageai";
import z from "zod";

import { authed, pub } from "@/orpc";

const voyageClient = new VoyageAIClient({
	apiKey: env.VOYAGE_API_KEY as string,
});

// ============================================================================
// Types
// ============================================================================

type TemplateWithRelations = Template & {
	favouriteOf: Array<{ id: string }>;
	author: User;
	_count: { favouriteOf: number };
};

// ============================================================================
// Embedding Generation
// ============================================================================

async function generateEmbeddings(
	content: string,
	title: string,
	category: string,
): Promise<{ embedding: number[] }> {
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
}

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
});

const updateTemplateInput = z.object({
	id: z.string(),
	category: z.string().min(1, "Category is required"),
	name: z.string().min(1, "Name is required"),
	content: z.string(),
});

const favouriteInput = z.object({
	templateId: z.string(),
});

// ============================================================================
// Public Handlers
// ============================================================================

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

		// Get users who favourited this template
		const favouriteUsers = await context.db
			.select({ id: favourites.B })
			.from(favourites)
			.where(eq(favourites.A, input.id));

		// Get count
		const [countResult] = await context.db
			.select({ count: sql<number>`COUNT(*)` })
			.from(favourites)
			.where(eq(favourites.A, input.id));

		return {
			...templateData,
			favouriteOf: favouriteUsers,
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
				favouriteOf: sql<number>`(
					SELECT COUNT(*) FROM "_favourites"
					WHERE "_favourites"."A" = ${template.id}
				)`.as("favouriteCount"),
			},
		})
		.from(template)
		.innerJoin(favourites, eq(favourites.A, template.id))
		.where(eq(favourites.B, context.session.user.id))
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
				favouriteOf: sql<number>`(
					SELECT COUNT(*) FROM "_favourites"
					WHERE "_favourites"."A" = ${template.id}
				)`.as("favouriteCount"),
			},
		})
		.from(template)
		.where(eq(template.authorId, context.session.user.id))
		.orderBy(desc(template.updatedAt))
		.limit(3);

	return userTemplates;
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

		const result = await context.db
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

		return newTemplate;
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

		const result = await context.db
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

		return updatedTemplate;
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
				A: input.templateId,
				B: context.session.user.id,
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
					eq(favourites.A, input.templateId),
					eq(favourites.B, context.session.user.id),
				),
			);

		return { success: true };
	});

// ============================================================================
// Exports
// ============================================================================

export const templatesHandler = {
	// Public
	get: getTemplateHandler,
	// Authenticated - Read
	favourites: getFavouritesHandler,
	authored: getAuthoredHandler,
	// Authenticated - CRUD
	create: createTemplateHandler,
	update: updateTemplateHandler,
	// Authenticated - Favourites
	addFavourite: addFavouriteHandler,
	removeFavourite: removeFavouriteHandler,
};
