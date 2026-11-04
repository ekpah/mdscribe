import { eq, user } from "@repo/database";
import type { Database } from "@repo/database";
import { z } from "zod";

import { PERSONAL_CONTEXT_MAX_LENGTH } from "@/lib/personal-context";
import { authed } from "@/orpc";

export const getUserPersonalContext = async (db: Database, userId: string): Promise<string> => {
	const [row] = await db
		.select({ personalContext: user.personalContext })
		.from(user)
		.where(eq(user.id, userId))
		.limit(1);
	return row?.personalContext ?? "";
};

const getPersonalContextHandler = authed.handler(async ({ context }) => ({
	personalContext: await getUserPersonalContext(context.db, context.session.user.id),
}));

const updatePersonalContextHandler = authed
	.input(z.object({ personalContext: z.string().max(PERSONAL_CONTEXT_MAX_LENGTH) }))
	.handler(async ({ context, input }) => {
		const personalContext = input.personalContext.trim();
		await context.db
			.update(user)
			.set({ personalContext: personalContext || null })
			.where(eq(user.id, context.session.user.id));
		return { personalContext };
	});

export const personalContextHandler = {
	get: getPersonalContextHandler,
	update: updatePersonalContextHandler,
};
