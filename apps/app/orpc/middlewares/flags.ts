import { ORPCError, os } from "@orpc/server";

import type { BooleanFlag } from "@/flags";

export const requiredFlagMiddleware = (featureFlag: BooleanFlag) =>
	os.$context<{ auth: { isAdmin: boolean } }>().middleware(async ({ context, next }) => {
		const enabled = await featureFlag.run({ identify: { isAdmin: context.auth.isAdmin } });
		if (!enabled) {
			throw new ORPCError("FORBIDDEN");
		}

		return next();
	});
