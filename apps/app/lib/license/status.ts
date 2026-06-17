import { count, user } from "@repo/database";
import type { Database } from "@repo/database";

import type { License, LicenseEdition } from "./types";
import { resolveLicense } from "./verify";

interface LicenseStatus {
	edition: LicenseEdition;
	licensee: string | null;
	/** The verified license, or `null` in the community configuration. */
	license: License | null;
	maxSeats: number | null;
	seatCount: number;
	/**
	 * Whether another account may be created. `true` when unlicensed/unlimited;
	 * `false` only when a finite `maxSeats` is reached. Enforcement is soft: this
	 * gates NEW signups only and never disables existing users.
	 */
	seatsAvailable: boolean;
	/** A configured license whose expiry has passed (still functional; warn only). */
	isExpired: boolean;
	isNotYetValid: boolean;
}

/**
 * Resolve the deployment-wide license status, including the current seat count.
 * Used by the admin license page and the signup seat check. This performs a
 * `count(*)` over users, so call it where that cost is acceptable (admin/auth),
 * not on hot per-request paths.
 */
export const resolveLicenseStatus = async (input: { db: Database }): Promise<LicenseStatus> => {
	const [license, [seatRow]] = await Promise.all([
		resolveLicense(),
		input.db.select({ value: count() }).from(user),
	]);

	const seatCount = seatRow?.value ?? 0;
	const maxSeats = license?.maxSeats ?? null;

	return {
		edition: license?.edition ?? "community",
		isExpired: license?.isExpired ?? false,
		isNotYetValid: license?.isNotYetValid ?? false,
		license,
		licensee: license?.licensee ?? null,
		maxSeats,
		seatCount,
		seatsAvailable: maxSeats === null || seatCount < maxSeats,
	};
};
