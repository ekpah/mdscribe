import { ORPCError, os, ValidationError } from "@orpc/server";

import { requiredAuthMiddleware } from "./orpc/middlewares/auth";
import { dbProviderMiddleware } from "./orpc/middlewares/db";

/** Surface the first schema issue (our localized zod messages) instead of oRPC's generic text. */
const inputIssueMessageMiddleware = os.middleware(async ({ next }) => {
	try {
		return await next();
	} catch (error) {
		if (
			error instanceof ORPCError &&
			error.code === "BAD_REQUEST" &&
			error.cause instanceof ValidationError
		) {
			throw new ORPCError("BAD_REQUEST", {
				cause: error.cause,
				data: error.data,
				message: error.cause.issues[0]?.message ?? "Ungültige Eingabe",
			});
		}
		throw error;
	}
});

export const pub = os.use(inputIssueMessageMiddleware).use(dbProviderMiddleware);

export const authed = pub.use(requiredAuthMiddleware);
