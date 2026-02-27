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
				id: template.id,
				title: template.title,
				category: template.category,
				authorId: template.authorId,
				updatedAt: template.updatedAt,
				hasEmbedding: sql<boolean>`${template.embedding} IS NOT NULL`.as(
					"hasEmbedding",
				),
				author: {
					id: user.id,
					name: user.name,
					email: user.email,
				},
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
					id: user.id,
					name: user.name,
					email: user.email,
				},
			})
			.from(favourites)
			.innerJoin(user, eq(favourites.userId, user.id))
			.where(inArray(favourites.templateId, templateIds));

		const favouritesByTemplate = new Map<
			string,
			Array<{
				id: string;
				name: string | null;
				email: string;
			}>
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
				favouriteOf,
				_count: {
					favouriteOf: favouriteOf.length,
				},
			};
		});
	});

export const templatesHandler = {
	list: listAdminTemplatesHandler,
};
