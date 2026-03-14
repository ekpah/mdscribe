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
	description: z.string().max(500).optional().nullable(),
	name: z.string().min(1, "Name ist erforderlich").max(100),
});

const updateCollectionInput = z.object({
	description: z.string().max(500).optional().nullable(),
	id: z.string(),
	name: z.string().min(1, "Name ist erforderlich").max(100),
});

const collectionTemplateInput = z.object({
	collectionId: z.string(),
	templateId: z.string(),
});

const listCollectionsHandler = authed.handler(async ({ context }) => {
	const collections = await context.db
		.select({
			createdAt: templateCollection.createdAt,
			description: templateCollection.description,
			id: templateCollection.id,
			name: templateCollection.name,
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
			category: template.category,
			collectionId: templateCollectionTemplate.collectionId,
			favouritesCount: favouriteCount(template.id),
			id: template.id,
			title: template.title,
		})
		.from(templateCollectionTemplate)
		.innerJoin(template, eq(templateCollectionTemplate.templateId, template.id))
		.where(inArray(templateCollectionTemplate.collectionId, collectionIds))
		.orderBy(desc(template.updatedAt));

	const templatesByCollection: Record<
		string,
		{
			category: string;
			favouritesCount: number;
			id: string;
			title: string;
		}[]
	> = {};
	for (const row of templates) {
		const entry = {
			category: row.category,
			favouritesCount: Number(row.favouritesCount ?? 0),
			id: row.id,
			title: row.title,
		};
		if (templatesByCollection[row.collectionId]) {
			templatesByCollection[row.collectionId]?.push(entry);
		} else {
			templatesByCollection[row.collectionId] = [entry];
		}
	}

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
				description: input.description?.trim() || null,
				name: input.name.trim(),
				updatedAt: new Date(),
				userId: context.session.user.id,
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
				description: input.description?.trim() || null,
				name: input.name.trim(),
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
	addTemplate: addTemplateToCollectionHandler,
	create: createCollectionHandler,
	delete: deleteCollectionHandler,
	list: listCollectionsHandler,
	removeTemplate: removeTemplateFromCollectionHandler,
	update: updateCollectionHandler,
};
