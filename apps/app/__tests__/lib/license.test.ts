import { beforeAll, describe, expect, test } from "bun:test";

import { signLicenseToken } from "@/lib/license/envelope";
import type { LicenseClaims } from "@/lib/license/types";
import { verifyLicense } from "@/lib/license/verify";

const toBase64Url = (buffer: ArrayBuffer): string => Buffer.from(buffer).toString("base64url");

let publicKey = "";
let privateKey = "";
let otherPublicKey = "";

const generateKeypair = async () => {
	const pair = (await crypto.subtle.generateKey({ name: "Ed25519" }, true, [
		"sign",
		"verify",
	])) as CryptoKeyPair;
	return {
		privateKey: toBase64Url(await crypto.subtle.exportKey("pkcs8", pair.privateKey)),
		publicKey: toBase64Url(await crypto.subtle.exportKey("raw", pair.publicKey)),
	};
};

const baseClaims = (overrides: Partial<LicenseClaims> = {}): LicenseClaims => ({
	edition: "licensed",
	expiresAt: "2027-01-01T00:00:00.000Z",
	features: [],
	issuedAt: "2026-01-01T00:00:00.000Z",
	licensee: "Test Hospital",
	maxSeats: 50,
	notBefore: null,
	v: 1,
	...overrides,
});

const now = new Date("2026-06-16T00:00:00.000Z");

beforeAll(async () => {
	const mine = await generateKeypair();
	({ publicKey } = mine);
	({ privateKey } = mine);
	const other = await generateKeypair();
	otherPublicKey = other.publicKey;
});

describe("license verification", () => {
	test("verifies a valid token and parses claims", async () => {
		const token = await signLicenseToken(baseClaims(), privateKey);
		const license = await verifyLicense(token, { now, publicKey });

		expect(license).not.toBeNull();
		expect(license?.licensee).toBe("Test Hospital");
		expect(license?.edition).toBe("licensed");
		expect(license?.maxSeats).toBe(50);
		expect(license?.isExpired).toBe(false);
		expect(license?.isNotYetValid).toBe(false);
	});

	test("flags an expired token but still returns it (soft enforcement)", async () => {
		const token = await signLicenseToken(
			baseClaims({ expiresAt: "2026-01-01T00:00:00.000Z" }),
			privateKey,
		);
		const license = await verifyLicense(token, { now, publicKey });

		expect(license).not.toBeNull();
		expect(license?.isExpired).toBe(true);
	});

	test("treats maxSeats null as unlimited", async () => {
		const token = await signLicenseToken(baseClaims({ maxSeats: null }), privateKey);
		const license = await verifyLicense(token, { now, publicKey });

		expect(license?.maxSeats).toBeNull();
	});

	test("flags a not-yet-valid token", async () => {
		const token = await signLicenseToken(
			baseClaims({ notBefore: "2026-12-01T00:00:00.000Z" }),
			privateKey,
		);
		const license = await verifyLicense(token, { now, publicKey });

		expect(license?.isNotYetValid).toBe(true);
	});

	test("rejects a tampered payload", async () => {
		const token = await signLicenseToken(baseClaims(), privateKey);
		const [prefix, payload, signature] = token.split(".");
		const tampered = `${prefix}.${payload}x.${signature}`;

		expect(await verifyLicense(tampered, { now, publicKey })).toBeNull();
	});

	test("rejects a token signed by a different key", async () => {
		const token = await signLicenseToken(baseClaims(), privateKey);

		expect(await verifyLicense(token, { now, publicKey: otherPublicKey })).toBeNull();
	});

	test("rejects malformed tokens", async () => {
		expect(await verifyLicense("not-a-token", { now, publicKey })).toBeNull();
		expect(await verifyLicense("MDSL1.onlytwo", { now, publicKey })).toBeNull();
		expect(await verifyLicense("WRONG.a.b", { now, publicKey })).toBeNull();
	});

	test("returns null for an absent token", async () => {
		expect(await verifyLicense(undefined, { now, publicKey })).toBeNull();
		expect(await verifyLicense("", { now, publicKey })).toBeNull();
	});

	test("rejects a well-signed token with invalid claims shape", async () => {
		const token = await signLicenseToken({ foo: "bar", v: 1 }, privateKey);

		expect(await verifyLicense(token, { now, publicKey })).toBeNull();
	});
});
