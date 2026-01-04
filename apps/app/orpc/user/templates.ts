import {
	and,
	desc,
	eq,
	favourites,
	sql,
	template,
	usageEvent,
} from "@repo/database";
import { env } from "@repo/env";
import { VoyageAIClient } from "voyageai";
import z from "zod";

import { authed } from "@/orpc";

const voyageClient = new VoyageAIClient({ apiKey: env.VOYAGE_API_KEY as string });

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

// Template routes
const getFavoriteTemplatesHandler = authed.handler(async ({ context }) => {
	// Get templates that this user has favourited
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

const getAuthoredTemplatesHandler = authed.handler(async ({ context }) => {
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

const getRecentActivityHandler = authed.handler(async ({ context }) => {
	const recentEvents = await context.db
		.select()
		.from(usageEvent)
		.where(eq(usageEvent.userId, context.session.user.id))
		.orderBy(desc(usageEvent.timestamp))
		.limit(5);

	return recentEvents;
});

// Input schemas
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

// Create template handler
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

// Update template handler
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

// Add favourite handler
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

// Remove favourite handler
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

export const templatesHandler = {
	favourites: getFavoriteTemplatesHandler,
	authored: getAuthoredTemplatesHandler,
	recentActivity: getRecentActivityHandler,
	create: createTemplateHandler,
	update: updateTemplateHandler,
	addFavourite: addFavouriteHandler,
	removeFavourite: removeFavouriteHandler,
};
