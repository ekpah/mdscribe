import { env } from "@repo/env";

import { verifyLicenseToken } from "./envelope";
import { LICENSE_PUBLIC_KEY } from "./public-key";
import type { License, LicenseClaims, LicenseEdition } from "./types";

const VALID_EDITIONS: ReadonlySet<LicenseEdition> = new Set<LicenseEdition>([
	"community",
	"licensed",
]);

const isLicenseClaims = (value: unknown): value is LicenseClaims => {
	if (typeof value !== "object" || value === null) {
		return false;
	}
	const candidate = value as Record<string, unknown>;
	const { edition, maxSeats } = candidate;
	return (
		candidate.v === 1 &&
		typeof candidate.licensee === "string" &&
		typeof edition === "string" &&
		VALID_EDITIONS.has(edition as LicenseEdition) &&
		(maxSeats === null || (typeof maxSeats === "number" && maxSeats >= 0)) &&
		Array.isArray(candidate.features) &&
		candidate.features.every((feature) => typeof feature === "string") &&
		typeof candidate.issuedAt === "string" &&
		(candidate.notBefore === null || typeof candidate.notBefore === "string") &&
		(candidate.expiresAt === null || typeof candidate.expiresAt === "string")
	);
};

const normalize = (claims: LicenseClaims, now: Date): License => {
	const expiresAt = claims.expiresAt ? new Date(claims.expiresAt) : null;
	const notBefore = claims.notBefore ? new Date(claims.notBefore) : null;
	return {
		...claims,
		isExpired: expiresAt !== null && expiresAt.getTime() < now.getTime(),
		isNotYetValid: notBefore !== null && notBefore.getTime() > now.getTime(),
	};
};

/**
 * Verify a raw license token string against the embedded public key. Exposed
 * separately from `resolveLicense` so it can be unit-tested with arbitrary
 * tokens and a fixed clock. Returns `null` for absent/malformed/invalid tokens.
 */
export const verifyLicense = async (
	token: string | undefined | null,
	options?: { now?: Date; publicKey?: string },
): Promise<License | null> => {
	if (!token) {
		return null;
	}
	const payload = await verifyLicenseToken(token, options?.publicKey ?? LICENSE_PUBLIC_KEY);
	if (payload === null || !isLicenseClaims(payload)) {
		return null;
	}
	return normalize(payload, options?.now ?? new Date());
};

let cached: { token: string | undefined; license: License | null } | null = null;

/**
 * Resolve the active deployment license from `MDSCRIBE_LICENSE_KEY`.
 *
 * Returns `null` when no key is configured (free community configuration) or
 * when the configured key is malformed/invalid. An expired or not-yet-valid key
 * is still returned (flags set) so callers can warn rather than silently drop
 * the edition. The result is memoized per token for the process lifetime; this
 * is the single seam a managed provider (e.g. Keygen) would replace later.
 */
export const resolveLicense = async (): Promise<License | null> => {
	const token = env.MDSCRIBE_LICENSE_KEY as string | undefined;
	if (cached !== null && cached.token === token) {
		return cached.license;
	}
	const license = await verifyLicense(token);
	cached = { license, token };
	return license;
};
