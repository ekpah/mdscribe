import { resolveLicenseStatus } from "@/lib/license/status";
import { authed } from "@/orpc";
import { requiredAdminMiddleware } from "@/orpc/middlewares/admin";

/**
 * Read-only license status for the admin license page. Surfaces the verified
 * deployment license, seat usage, and soft-warning flags. There is no mutation
 * here: the license key is configured via the `MDSCRIBE_LICENSE_KEY` env var.
 */
const getLicenseStatusHandler = authed.use(requiredAdminMiddleware).handler(async ({ context }) => {
	const status = await resolveLicenseStatus({ db: context.db });

	return {
		edition: status.edition,
		expiresAt: status.license?.expiresAt ?? null,
		features: status.license?.features ?? [],
		isConfigured: status.license !== null,
		isExpired: status.isExpired,
		isNotYetValid: status.isNotYetValid,
		issuedAt: status.license?.issuedAt ?? null,
		licensee: status.licensee,
		maxSeats: status.maxSeats,
		seatCount: status.seatCount,
		seatsAvailable: status.seatsAvailable,
	};
});

export const licenseHandler = {
	get: getLicenseStatusHandler,
};
