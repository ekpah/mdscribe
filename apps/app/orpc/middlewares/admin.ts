import { ORPCError, os } from "@orpc/server";
import type { Session } from "@/lib/auth-types";

const ADMIN_EMAILS = ["nils.hapke@we-mail.de", "n.hapke@bbtgruppe.de"];

export const requiredAdminMiddleware = os
	.$context<{ session: Session }>()
	.middleware(({ context, next }) => {
		const email = context.session.user.email;

		if (!ADMIN_EMAILS.includes(email)) {
			throw new ORPCError("FORBIDDEN");
		}

		return next({ context });
	});
