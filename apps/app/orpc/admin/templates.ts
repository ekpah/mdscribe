import { desc, eq, template, user } from "@repo/database";
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

export const templatesHandler = {
	get: getAdminTemplateHandler,
	list: listAdminTemplatesHandler,
};
