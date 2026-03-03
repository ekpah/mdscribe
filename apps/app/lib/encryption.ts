import "server-only";

import { env } from "@repo/env";

const IV_LENGTH = 12;
const TAG_LENGTH = 16;

/**
 * Derive a 256-bit key from BETTER_AUTH_SECRET using SHA-256.
 */
const deriveKey = async (): Promise<CryptoKey> => {
	const keyMaterial = new TextEncoder().encode(
		env.BETTER_AUTH_SECRET as string,
	);
	const hash = await crypto.subtle.digest("SHA-256", keyMaterial);
	return crypto.subtle.importKey("raw", hash, { name: "AES-GCM" }, false, [
		"encrypt",
		"decrypt",
	]);
};

/**
 * Encrypt plaintext using AES-256-GCM.
 * Returns a base64 string containing IV + ciphertext + auth tag.
 */
export const encrypt = async (plaintext: string): Promise<string> => {
	const key = await deriveKey();
	const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
	const encoded = new TextEncoder().encode(plaintext);

	const cipherBuffer = await crypto.subtle.encrypt(
		{ iv, name: "AES-GCM", tagLength: TAG_LENGTH * 8 },
		key,
		encoded,
	);

	// Combine IV + ciphertext+tag into a single buffer
	const combined = new Uint8Array(IV_LENGTH + cipherBuffer.byteLength);
	combined.set(iv, 0);
	combined.set(new Uint8Array(cipherBuffer), IV_LENGTH);

	return Buffer.from(combined).toString("base64");
};

/**
 * Decrypt a base64 string produced by encrypt().
 */
export const decrypt = async (base64: string): Promise<string> => {
	const key = await deriveKey();
	const combined = new Uint8Array(Buffer.from(base64, "base64"));

	const iv = combined.slice(0, IV_LENGTH);
	const ciphertext = combined.slice(IV_LENGTH);

	const decrypted = await crypto.subtle.decrypt(
		{ iv, name: "AES-GCM", tagLength: TAG_LENGTH * 8 },
		key,
		ciphertext,
	);

	return new TextDecoder().decode(decrypted);
};
