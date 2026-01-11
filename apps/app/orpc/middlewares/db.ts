import { os } from "@orpc/server";
import type { Database } from "@repo/database";
import { database } from "@repo/database";

export const dbProviderMiddleware = os
	.$context<{ db?: Database }>()
	.middleware(({ context, next }) => {
		/**
		 * Why we should ?? here?
		 * Because it can avoid `createFakeDB` being called when unnecessary.
		 * {@link https://orpc.unnoq.com/docs/best-practices/dedupe-middleware}
		 */
		const db: Database = context.db ?? database;

		return next({
			context: {
				db,
			},
		});
	});
