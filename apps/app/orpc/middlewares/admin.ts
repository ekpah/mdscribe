import { ORPCError, os } from "@orpc/server";
import type { Session } from "@/lib/auth-types";

export const requiredAdminMiddleware = os
	.$context<{ auth: { isAdmin: boolean }; session: Session }>()
	.middleware(({ context, next }) => {
		if (!context.auth?.isAdmin) {
			throw new ORPCError("FORBIDDEN");
		}

		return next({ context });
	});
