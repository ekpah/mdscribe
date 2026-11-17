import { ORPCError } from "@orpc/server";
import { aiDefaults, and, desc, eq, template, templateCollection, user } from "@repo/database";
import { z } from "zod";

import { authed } from "@/orpc";
import { requiredAdminMiddleware } from "@/orpc/middlewares/admin";

const getAdminTemplateHandler = authed
	.use(requiredAdminMiddleware)
	.input(z.object({ id: z.string() }))
	.handler(async ({ context, input }) => {
		const [templateData] = await context.db
			.select({
				author: {
					email: user.email,
					id: user.id,
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
			.where(eq(template.id, input.id))
			.limit(1);

		return templateData ?? null;
	});

const listAdminTemplatesHandler = authed
	.use(requiredAdminMiddleware)
	.handler(async ({ context }) => {
		const templates = await context.db
			.select({
				author: {
					email: user.email,
					id: user.id,
					name: user.name,
				},
				authorId: template.authorId,
				id: template.id,
				title: template.title,
				updatedAt: template.updatedAt,
				visibility: template.visibility,
			})
			.from(template)
			.leftJoin(user, eq(template.authorId, user.id))
			.orderBy(desc(template.updatedAt));

		return templates.map((item) => ({
			...item,
			isAuthored: item.authorId === context.session.user.id,
		}));
	});

const getAiScribeCollectionHandler = authed
	.use(requiredAdminMiddleware)
	.handler(async ({ context }) => {
		const [row] = await context.db
			.select({ collectionId: aiDefaults.aiScribeCollectionId })
			.from(aiDefaults)
			.where(eq(aiDefaults.id, "global"));
		return { collectionId: row?.collectionId ?? null };
	});

/** Picks one of the admin's own collections as the default list on `/aiscribe`. */
const setAiScribeCollectionHandler = authed
	.use(requiredAdminMiddleware)
	.input(z.object({ collectionId: z.string().nullable() }))
	.handler(async ({ context, input }) => {
		if (input.collectionId) {
			const [owned] = await context.db
				.select({ id: templateCollection.id })
				.from(templateCollection)
				.where(
					and(
						eq(templateCollection.id, input.collectionId),
						eq(templateCollection.userId, context.session.user.id),
					),
				);
			if (!owned) {
				throw new ORPCError("NOT_FOUND", { message: "Sammlung wurde nicht gefunden" });
			}
		}
		await context.db
			.insert(aiDefaults)
			.values({ aiScribeCollectionId: input.collectionId, id: "global", updatedAt: new Date() })
			.onConflictDoUpdate({
				set: { aiScribeCollectionId: input.collectionId, updatedAt: new Date() },
				target: aiDefaults.id,
			});
		return { collectionId: input.collectionId };
	});

export const templatesHandler = {
	aiScribeCollection: getAiScribeCollectionHandler,
	get: getAdminTemplateHandler,
	list: listAdminTemplatesHandler,
	setAiScribeCollection: setAiScribeCollectionHandler,
};
