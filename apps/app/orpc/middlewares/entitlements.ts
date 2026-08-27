import { os } from "@orpc/server";
import type { Database } from "@repo/database";

import type { Session } from "@/lib/auth-types";
import { resolveScribeEntitlements } from "@/orpc/scribe/handlers/usage-limit";

export const scribeEntitlementsMiddleware = os
	.$context<{ db: Database; session: Session }>()
	.middleware(async ({ context, next }) => {
		const entitlements = await resolveScribeEntitlements({
			db: context.db,
			userId: context.session.user.id,
		});

		return next({
			context: {
				entitlements: {
					scribe: entitlements,
				},
			},
		});
	});
