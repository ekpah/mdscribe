/**
 * Offline license-token envelope.
 *
 * A token is a PASETO-style versioned envelope:
 *
 *   MDSL1.<base64url(payloadJson)>.<base64url(signature)>
 *
 * The signature is an Ed25519 signature over the UTF-8 bytes of the
 * `MDSL1.<base64url(payloadJson)>` prefix (version tag + payload segment), so
 * the algorithm and format are fixed by the version tag — there is no
 * algorithm field to confuse, which is the property that makes this safe to use
 * as a license gate. Verification is fully offline against an embedded public
 * key; see `verify.ts`.
 *
 * Keep this module dependency-free and runtime-agnostic (WebCrypto only) so it
 * can be shared between the app verifier and the offline `sign-license` CLI.
 */

const LICENSE_TOKEN_PREFIX = "MDSL1" as const;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

// Copy into a freshly-allocated, ArrayBuffer-backed Uint8Array. WebCrypto's
// BufferSource type rejects `Uint8Array<ArrayBufferLike>` (it could be a
// SharedArrayBuffer); a plain `new Uint8Array(n)` is backed by ArrayBuffer.
const toArrayBufferBytes = (bytes: Uint8Array): Uint8Array<ArrayBuffer> => {
	const copy = new Uint8Array(bytes.byteLength);
	copy.set(bytes);
	return copy;
};

const encode = (text: string): Uint8Array<ArrayBuffer> =>
	toArrayBufferBytes(textEncoder.encode(text));

const toBase64Url = (bytes: Uint8Array): string => Buffer.from(bytes).toString("base64url");

const fromBase64Url = (value: string): Uint8Array<ArrayBuffer> =>
	toArrayBufferBytes(new Uint8Array(Buffer.from(value, "base64url")));

const importPublicKey = (rawPublicKey: Uint8Array<ArrayBuffer>): Promise<CryptoKey> =>
	crypto.subtle.importKey("raw", rawPublicKey, { name: "Ed25519" }, false, ["verify"]);

const importPrivateKey = (pkcs8PrivateKey: Uint8Array<ArrayBuffer>): Promise<CryptoKey> =>
	crypto.subtle.importKey("pkcs8", pkcs8PrivateKey, { name: "Ed25519" }, false, ["sign"]);

/**
 * Sign a claims payload into a license token. Used only by the offline minting
 * CLI; the private key never ships with the app.
 */
export const signLicenseToken = async (
	payload: unknown,
	pkcs8PrivateKeyBase64Url: string,
): Promise<string> => {
	const payloadSegment = toBase64Url(textEncoder.encode(JSON.stringify(payload)));
	const signingInput = `${LICENSE_TOKEN_PREFIX}.${payloadSegment}`;
	const privateKey = await importPrivateKey(fromBase64Url(pkcs8PrivateKeyBase64Url));
	const signature = await crypto.subtle.sign("Ed25519", privateKey, encode(signingInput));
	return `${signingInput}.${toBase64Url(new Uint8Array(signature))}`;
};

/**
 * Verify a license token against a raw Ed25519 public key and return the parsed
 * payload, or `null` if the token is malformed, has a bad signature, or fails
 * to parse. Never throws.
 */
export const verifyLicenseToken = async (
	token: string,
	rawPublicKeyBase64Url: string,
): Promise<Record<string, unknown> | null> => {
	const segments = token.trim().split(".");
	if (segments.length !== 3) {
		return null;
	}
	const [prefix, payloadSegment, signatureSegment] = segments;
	if (prefix !== LICENSE_TOKEN_PREFIX || !payloadSegment || !signatureSegment) {
		return null;
	}

	try {
		const publicKey = await importPublicKey(fromBase64Url(rawPublicKeyBase64Url));
		const isValid = await crypto.subtle.verify(
			"Ed25519",
			publicKey,
			fromBase64Url(signatureSegment),
			encode(`${prefix}.${payloadSegment}`),
		);
		if (!isValid) {
			return null;
		}
		const parsed: unknown = JSON.parse(textDecoder.decode(fromBase64Url(payloadSegment)));
		if (typeof parsed !== "object" || parsed === null) {
			return null;
		}
		return parsed as Record<string, unknown>;
	} catch {
		return null;
	}
};
