import { ORPCError, os } from "@orpc/server";
import type { Session } from "@/lib/auth-types";
import { env } from "@repo/env";

export const requiredAdminMiddleware = os
	.$context<{ session: Session }>()
	.middleware(({ context, next }) => {
		const email = context.session.user.email;

		if (email !== env.ADMIN_EMAIL) {
			throw new ORPCError("FORBIDDEN");
		}

		return next({ context });
	});
