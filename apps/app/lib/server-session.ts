import "server-only";
import { headers } from "next/headers";
import { cache } from "react";
import { auth } from "@/auth";
import type { Session } from "./auth-types";
import { normalizeSession } from "./session-query";

/**
 * Request-scoped session lookup.
 * `cache()` deduplicates repeated session reads during a single RSC render pass.
 */
export const getServerSession = cache(async (): Promise<Session | null> => {
	const requestHeaders = await headers();
	const session = await auth.api.getSession({
		headers: requestHeaders,
	});
	return normalizeSession(session);
});
