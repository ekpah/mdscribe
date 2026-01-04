import {
	desc,
	favourites,
	sql,
	template,
	usageEvent,
	user,
} from "@repo/database";

import { authed } from "@/orpc";
import { requiredAdminMiddleware } from "../middlewares/admin";

const adminUsersHandler = authed
	.use(requiredAdminMiddleware)
	.handler(async ({ context }) => {
		const users = await context.db
			.select({
				id: user.id,
				name: user.name,
				email: user.email,
				emailVerified: user.emailVerified,
				image: user.image,
				createdAt: user.createdAt,
				updatedAt: user.updatedAt,
				_count: {
					templates: sql<number>`(
						SELECT COUNT(*) FROM "Template"
						WHERE "Template"."authorId" = ${user.id}
					)`.as("templatesCount"),
					favourites: sql<number>`(
						SELECT COUNT(*) FROM "_favourites"
						WHERE "_favourites"."B" = ${user.id}
					)`.as("favouritesCount"),
					usageEvents: sql<number>`(
						SELECT COUNT(*) FROM "UsageEvent"
						WHERE "UsageEvent"."userId" = ${user.id}
					)`.as("usageEventsCount"),
				},
			})
			.from(user)
			.orderBy(desc(user.createdAt));

		return users;
	});

export const usersHandler = {
	list: adminUsersHandler,
};
