// Zero-knowledge context transfer crypto. The payload is encrypted client-side
// with a random AES-GCM key that only ever travels in the URL fragment; the
// server stores the opaque envelope under a hash of a separate random token.

const TRANSFER_TOKEN_BYTES = 32;
const TRANSFER_KEY_BYTES = 32;
const TRANSFER_IV_BYTES = 12;
const ENVELOPE_VERSION = 1;

// Sized to cover the maximum the input controls allow (30 MiB audio + 25 MiB
// files, base64-encoded into the payload JSON at 4/3, plus text): ~74 MiB.
// The envelope cap adds the version byte, IV, GCM tag, and base64url expansion.
export const MAX_TRANSFER_PAYLOAD_BYTES = 80 * 1024 * 1024;
export const MAX_TRANSFER_ENVELOPE_CHARS = Math.ceil(((MAX_TRANSFER_PAYLOAD_BYTES + 1024) * 4) / 3);

export class TransferPayloadTooLargeError extends Error {
	constructor() {
		super("Transfer payload too large");
		this.name = "TransferPayloadTooLargeError";
	}
}

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

const bytesToBase64Url = (bytes: Uint8Array): string => {
	const chunkSize = 8192;
	const chunks: string[] = [];
	for (let index = 0; index < bytes.length; index += chunkSize) {
		chunks.push(String.fromCodePoint(...bytes.subarray(index, index + chunkSize)));
	}
	return btoa(chunks.join("")).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
};

const base64UrlToBytes = (value: string): Uint8Array => {
	const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
	const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
	return Uint8Array.from(atob(padded), (char) => char.codePointAt(0) ?? 0);
};

const toArrayBuffer = (bytes: Uint8Array): ArrayBuffer =>
	bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;

export const createTransferToken = (): string => {
	const bytes = new Uint8Array(TRANSFER_TOKEN_BYTES);
	crypto.getRandomValues(bytes);
	return bytesToBase64Url(bytes);
};

export const createTransferKey = (): string => {
	const bytes = new Uint8Array(TRANSFER_KEY_BYTES);
	crypto.getRandomValues(bytes);
	return bytesToBase64Url(bytes);
};

export const hashTransferToken = async (token: string): Promise<string | null> => {
	const tokenBytes = base64UrlToBytes(token);
	if (tokenBytes.byteLength < TRANSFER_TOKEN_BYTES) {
		return null;
	}
	const hash = await crypto.subtle.digest("SHA-256", toArrayBuffer(tokenBytes));
	return bytesToBase64Url(new Uint8Array(hash));
};

const importAesKey = (keyBytes: Uint8Array, usage: KeyUsage): Promise<CryptoKey> =>
	crypto.subtle.importKey("raw", toArrayBuffer(keyBytes), { name: "AES-GCM" }, false, [usage]);

export const encryptTransferEnvelope = async (
	payload: unknown,
	key = createTransferKey(),
): Promise<{ envelope: string; key: string; payloadBytes: number }> => {
	const keyBytes = base64UrlToBytes(key);
	if (keyBytes.byteLength !== TRANSFER_KEY_BYTES) {
		throw new Error("Invalid transfer key");
	}
	const iv = new Uint8Array(TRANSFER_IV_BYTES);
	crypto.getRandomValues(iv);

	const plaintext = textEncoder.encode(JSON.stringify(payload));
	if (plaintext.byteLength > MAX_TRANSFER_PAYLOAD_BYTES) {
		throw new TransferPayloadTooLargeError();
	}

	const cryptoKey = await importAesKey(keyBytes, "encrypt");
	const ciphertext = new Uint8Array(
		await crypto.subtle.encrypt({ iv, name: "AES-GCM" }, cryptoKey, toArrayBuffer(plaintext)),
	);

	const envelopeBytes = new Uint8Array(1 + iv.byteLength + ciphertext.byteLength);
	envelopeBytes[0] = ENVELOPE_VERSION;
	envelopeBytes.set(iv, 1);
	envelopeBytes.set(ciphertext, 1 + iv.byteLength);

	return {
		envelope: bytesToBase64Url(envelopeBytes),
		key,
		payloadBytes: plaintext.byteLength,
	};
};

export const decryptTransferEnvelope = async <T>(envelope: string, key: string): Promise<T> => {
	const envelopeBytes = base64UrlToBytes(envelope);
	if (envelopeBytes.byteLength < 1 + TRANSFER_IV_BYTES || envelopeBytes[0] !== ENVELOPE_VERSION) {
		throw new Error("Unsupported transfer envelope");
	}

	const iv = envelopeBytes.subarray(1, 1 + TRANSFER_IV_BYTES);
	const ciphertext = envelopeBytes.subarray(1 + TRANSFER_IV_BYTES);
	const cryptoKey = await importAesKey(base64UrlToBytes(key), "decrypt");
	const plaintext = await crypto.subtle.decrypt(
		{ iv: new Uint8Array(toArrayBuffer(iv)), name: "AES-GCM" },
		cryptoKey,
		toArrayBuffer(new Uint8Array(ciphertext)),
	);
	return JSON.parse(textDecoder.decode(plaintext)) as T;
};
