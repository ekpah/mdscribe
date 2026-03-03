import {
	desc,
	eq,
	favourites,
	inArray,
	sql,
	template,
	user,
} from "@repo/database";

import { authed } from "@/orpc";
import { requiredAdminMiddleware } from "../middlewares/admin";

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
				hasEmbedding: sql<boolean>`${template.embedding} IS NOT NULL`.as(
					"hasEmbedding",
				),
				id: template.id,
				title: template.title,
				updatedAt: template.updatedAt,
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
			};
		});
	});

export const templatesHandler = {
	list: listAdminTemplatesHandler,
};
