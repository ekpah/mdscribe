/**
 * The deployment edition, derived from the presence of a valid license key.
 * `community` is the free, unlicensed configuration; `licensed` is any paid
 * deployment (typically on-premise, seat-gated).
 */
export type LicenseEdition = "community" | "licensed";

/**
 * The claims encoded into a signed license token. Kept deliberately small so
 * tokens stay short and an offline reviewer can read them.
 */
export interface LicenseClaims {
	/** Envelope claims version. */
	v: 1;
	/** Who the license is issued to, e.g. "Klinikum Musterstadt". */
	licensee: string;
	edition: LicenseEdition;
	/** Maximum number of user accounts. `null` = unlimited / not seat-gated. */
	maxSeats: number | null;
	/** Optional feature flags for future enterprise modules (e.g. "sso"). */
	features: string[];
	/** ISO 8601 issue timestamp. */
	issuedAt: string;
	/** ISO 8601 not-before timestamp, or `null`. */
	notBefore: string | null;
	/** ISO 8601 expiry timestamp, or `null` for a perpetual license. */
	expiresAt: string | null;
}

/**
 * A verified, normalized license. Note that an expired or not-yet-valid license
 * is still returned (with `isExpired` / `isNotYetValid` set) rather than
 * discarded — enforcement is intentionally soft, so callers decide what to do
 * (e.g. show an admin warning) instead of the app silently losing its edition.
 */
export interface License extends LicenseClaims {
	isExpired: boolean;
	isNotYetValid: boolean;
}
