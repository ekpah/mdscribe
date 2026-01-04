import { type } from "@orpc/server";
import {
	eq,
	favourites,
	sql,
	template,
	user,
	type Template,
	type User,
} from "@repo/database";
import z from "zod";

import { pub } from "@/orpc";

type TemplateWithRelations = Template & {
	favouriteOf: Array<{ id: string }>;
	author: User;
	_count: { favouriteOf: number };
};

const getTemplateInput = z.object({
	id: z.string(),
});

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

export const templatesHandler = {
	get: getTemplateHandler,
};
