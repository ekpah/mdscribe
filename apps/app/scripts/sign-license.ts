/**
 * Mint a signed license key, offline.
 *
 *   bun run apps/app/scripts/sign-license.ts \
 *     --licensee "Klinikum Musterstadt" \
 *     --seats 50 \
 *     --expires 2027-06-16 \
 *     [--edition licensed] \
 *     [--features sso,audit] \
 *     [--not-before 2026-07-01]
 *
 * The private key is read from `apps/app/.license-signing-key.local` (created by
 * `license-keygen.ts`) or, if set, the `MDSCRIBE_LICENSE_SIGNING_KEY` env var.
 * The printed token is handed to the customer and set as `MDSCRIBE_LICENSE_KEY`
 * in their deployment. For an unlimited internal/cloud key, pass `--seats 0`
 * (treated as unlimited) and omit `--expires`.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { signLicenseToken } from "../lib/license/envelope";
import type { LicenseClaims } from "../lib/license/types";

const parseArgs = (argv: string[]): Map<string, string> => {
	const args = new Map<string, string>();
	for (let i = 0; i < argv.length; i += 1) {
		const token = argv[i];
		if (token.startsWith("--")) {
			const key = token.slice(2);
			const next = argv[i + 1];
			if (next && !next.startsWith("--")) {
				args.set(key, next);
				i += 1;
			} else {
				args.set(key, "true");
			}
		}
	}
	return args;
};

const toIsoOrNull = (value: string | undefined): string | null => {
	if (!value) {
		return null;
	}
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		throw new TypeError(`Invalid date: ${value}`);
	}
	return date.toISOString();
};

const loadPrivateKey = (): string => {
	const fromEnv = process.env.MDSCRIBE_LICENSE_SIGNING_KEY;
	if (fromEnv) {
		return fromEnv.trim();
	}
	const path = join(import.meta.dir, "..", ".license-signing-key.local");
	return readFileSync(path, "utf-8").trim();
};

const args = parseArgs(process.argv.slice(2));

const licensee = args.get("licensee");
if (!licensee) {
	throw new Error("--licensee is required");
}

const seatsRaw = args.get("seats");
const seats = seatsRaw === undefined ? null : Number.parseInt(seatsRaw, 10);
if (seats !== null && Number.isNaN(seats)) {
	throw new Error("--seats must be a number (use 0 for unlimited)");
}

const featuresRaw = args.get("features");
const features = featuresRaw
	? featuresRaw
			.split(",")
			.map((feature) => feature.trim())
			.filter(Boolean)
	: [];

const claims: LicenseClaims = {
	edition: (args.get("edition") as LicenseClaims["edition"]) ?? "licensed",
	expiresAt: toIsoOrNull(args.get("expires")),
	features,
	issuedAt: new Date().toISOString(),
	licensee,
	// 0 or absent means unlimited.
	maxSeats: seats && seats > 0 ? seats : null,
	notBefore: toIsoOrNull(args.get("not-before")),
	v: 1,
};

const token = await signLicenseToken(claims, loadPrivateKey());

process.stdout.write(
	[
		"",
		"License claims:",
		JSON.stringify(claims, null, 2),
		"",
		"MDSCRIBE_LICENSE_KEY:",
		token,
		"",
	].join("\n"),
);
