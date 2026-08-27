import { ORPCError, os } from "@orpc/server";
import { headers } from "next/headers";

import { auth } from "@/auth";
import { env } from "@/env";
import type { Session } from "@/lib/auth-types";

const getSession = async () => {
	const headerList = await headers();

	const session = await auth.api.getSession({
		headers: headerList,
	});
	return session;
};

export const getOptionalAuthSession = async (contextSession?: Session) => {
	if (contextSession) {
		return contextSession;
	}

	try {
		return await getSession();
	} catch {
		return null;
	}
};

export const requiredAuthMiddleware = os
	.$context<{ session?: Session }>()
	.middleware(async ({ context, next }) => {
		const session = context.session ?? (await getSession());
		if (!session?.user) {
			throw new ORPCError("UNAUTHORIZED");
		}

		return next({
			context: {
				auth: {
					isAdmin: session.user.email === env.ADMIN_EMAIL,
				},
				session,
			},
		});
	});
