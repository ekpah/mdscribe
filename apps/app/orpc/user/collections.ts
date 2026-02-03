import {
	and,
	count,
	desc,
	eq,
	favourites,
	inArray,
	sql,
	template,
	templateCollection,
	templateCollectionTemplate,
} from "@repo/database";
import { z } from "zod";

import { authed } from "@/orpc";

const favouriteCount = (templateId: typeof template.id) =>
	sql<number>`(SELECT ${count()} FROM ${favourites} WHERE ${favourites.templateId} = ${templateId})`.as(
		"favouriteCount",
	);

const collectionIdInput = z.object({
	id: z.string(),
});

const createCollectionInput = z.object({
	name: z.string().min(1, "Name ist erforderlich").max(100),
	description: z.string().max(500).optional().nullable(),
});

const updateCollectionInput = z.object({
	id: z.string(),
	name: z.string().min(1, "Name ist erforderlich").max(100),
	description: z.string().max(500).optional().nullable(),
});

const collectionTemplateInput = z.object({
	collectionId: z.string(),
	templateId: z.string(),
});

const listCollectionsHandler = authed.handler(async ({ context }) => {
	const collections = await context.db
		.select({
			id: templateCollection.id,
			name: templateCollection.name,
			description: templateCollection.description,
			createdAt: templateCollection.createdAt,
			updatedAt: templateCollection.updatedAt,
		})
		.from(templateCollection)
		.where(eq(templateCollection.userId, context.session.user.id))
		.orderBy(desc(templateCollection.updatedAt), desc(templateCollection.createdAt));

	if (collections.length === 0) {
		return [];
	}

	const collectionIds = collections.map((collection) => collection.id);

	const templates = await context.db
		.select({
			collectionId: templateCollectionTemplate.collectionId,
			id: template.id,
			title: template.title,
			category: template.category,
			favouritesCount: favouriteCount(template.id),
		})
		.from(templateCollectionTemplate)
		.innerJoin(template, eq(templateCollectionTemplate.templateId, template.id))
		.where(inArray(templateCollectionTemplate.collectionId, collectionIds))
		.orderBy(desc(template.updatedAt));

	const templatesByCollection = templates.reduce(
		(acc, row) => {
			const entry = {
				id: row.id,
				title: row.title,
				category: row.category,
				favouritesCount: Number(row.favouritesCount ?? 0),
			};
			if (!acc[row.collectionId]) {
				acc[row.collectionId] = [entry];
			} else {
				acc[row.collectionId]?.push(entry);
			}
			return acc;
		},
		{} as Record<
			string,
			Array<{
				id: string;
				title: string;
				category: string;
				favouritesCount: number;
			}>
		>,
	);

	return collections.map((collection) => ({
		...collection,
		templates: templatesByCollection[collection.id] ?? [],
	}));
});

const createCollectionHandler = authed
	.input(createCollectionInput)
	.handler(async ({ context, input }) => {
		const [collection] = await context.db
			.insert(templateCollection)
			.values({
				userId: context.session.user.id,
				name: input.name.trim(),
				description: input.description?.trim() || null,
				updatedAt: new Date(),
			})
			.returning();

		if (!collection) {
			throw new Error("Collection konnte nicht erstellt werden");
		}

		return collection;
	});

const updateCollectionHandler = authed
	.input(updateCollectionInput)
	.handler(async ({ context, input }) => {
		const [collection] = await context.db
			.update(templateCollection)
			.set({
				name: input.name.trim(),
				description: input.description?.trim() || null,
				updatedAt: new Date(),
			})
			.where(
				and(
					eq(templateCollection.id, input.id),
					eq(templateCollection.userId, context.session.user.id),
				),
			)
			.returning();

		if (!collection) {
			throw new Error("Collection nicht gefunden");
		}

		return collection;
	});

const deleteCollectionHandler = authed
	.input(collectionIdInput)
	.handler(async ({ context, input }) => {
		const [collection] = await context.db
			.delete(templateCollection)
			.where(
				and(
					eq(templateCollection.id, input.id),
					eq(templateCollection.userId, context.session.user.id),
				),
			)
			.returning();

		if (!collection) {
			throw new Error("Collection nicht gefunden");
		}

		return { success: true };
	});

const addTemplateToCollectionHandler = authed
	.input(collectionTemplateInput)
	.handler(async ({ context, input }) => {
		const [collection] = await context.db
			.select({ id: templateCollection.id })
			.from(templateCollection)
			.where(
				and(
					eq(templateCollection.id, input.collectionId),
					eq(templateCollection.userId, context.session.user.id),
				),
			)
			.limit(1);

		if (!collection) {
			throw new Error("Collection nicht gefunden");
		}

		await context.db
			.insert(templateCollectionTemplate)
			.values({
				collectionId: input.collectionId,
				templateId: input.templateId,
			})
			.onConflictDoNothing();

		await context.db
			.update(templateCollection)
			.set({ updatedAt: new Date() })
			.where(eq(templateCollection.id, input.collectionId));

		return { success: true };
	});

const removeTemplateFromCollectionHandler = authed
	.input(collectionTemplateInput)
	.handler(async ({ context, input }) => {
		const [collection] = await context.db
			.select({ id: templateCollection.id })
			.from(templateCollection)
			.where(
				and(
					eq(templateCollection.id, input.collectionId),
					eq(templateCollection.userId, context.session.user.id),
				),
			)
			.limit(1);

		if (!collection) {
			throw new Error("Collection nicht gefunden");
		}

		await context.db
			.delete(templateCollectionTemplate)
			.where(
				and(
					eq(templateCollectionTemplate.collectionId, input.collectionId),
					eq(templateCollectionTemplate.templateId, input.templateId),
				),
			);

		await context.db
			.update(templateCollection)
			.set({ updatedAt: new Date() })
			.where(eq(templateCollection.id, input.collectionId));

		return { success: true };
	});

export const collectionsHandler = {
	list: listCollectionsHandler,
	create: createCollectionHandler,
	update: updateCollectionHandler,
	delete: deleteCollectionHandler,
	addTemplate: addTemplateToCollectionHandler,
	removeTemplate: removeTemplateFromCollectionHandler,
};
