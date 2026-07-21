import { z } from "zod";
import { desc, eq, favourites, inArray, sql, template, user } from "@repo/database";

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
				category: template.category,
				hasEmbedding: sql<boolean>`${template.embedding} IS NOT NULL`.as("hasEmbedding"),
				id: template.id,
				title: template.title,
				updatedAt: template.updatedAt,
				visibility: template.visibility,
			})
			.from(template)
			.leftJoin(user, eq(template.authorId, user.id))
			.orderBy(desc(template.updatedAt));

		if (templates.length === 0) {
			return [];
		}

		const templateIds = templates.map((item) => item.id);
		const favouriteRows = await context.db
			.select({
				templateId: favourites.templateId,
				user: {
					email: user.email,
					id: user.id,
					name: user.name,
				},
			})
			.from(favourites)
			.innerJoin(user, eq(favourites.userId, user.id))
			.where(inArray(favourites.templateId, templateIds));

		const favouritesByTemplate = new Map<
			string,
			{
				id: string;
				name: string | null;
				email: string;
			}[]
		>();

		for (const row of favouriteRows) {
			const existing = favouritesByTemplate.get(row.templateId) ?? [];
			existing.push(row.user);
			favouritesByTemplate.set(row.templateId, existing);
		}

		return templates.map((item) => {
			const favouriteOf = favouritesByTemplate.get(item.id) ?? [];
			return {
				...item,
				_count: {
					favouriteOf: favouriteOf.length,
				},
				favouriteOf,
				isAuthored: item.authorId === context.session.user.id,
				isFavourite: favouriteOf.some((favUser) => favUser.id === context.session.user.id),
			};
		});
	});

export const templatesHandler = {
	get: getAdminTemplateHandler,
	list: listAdminTemplatesHandler,
};
