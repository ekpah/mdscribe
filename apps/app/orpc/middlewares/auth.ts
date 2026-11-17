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

/** Signed-in user id for public procedures, or null for anonymous callers. */
export const getOptionalUserId = async (context: unknown): Promise<string | null> => {
	const contextSession = (context as { session?: Session }).session;
	if (contextSession) {
		return contextSession.user.id;
	}

	try {
		const session = await getSession();
		return session?.user.id ?? null;
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
