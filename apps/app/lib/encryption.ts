import "server-only";
import { env } from "@/env";

import { encryptApiKey } from "./encryption-core";

const IV_LENGTH = 12;
const TAG_LENGTH = 16;

/**
 * Derive a 256-bit key from BETTER_AUTH_SECRET using SHA-256.
 */
let derivedKeyPromise: Promise<CryptoKey> | undefined;

const deriveKey = (): Promise<CryptoKey> => {
	if (derivedKeyPromise) {
		return derivedKeyPromise;
	}

	derivedKeyPromise = (async () => {
		const keyMaterial = new TextEncoder().encode(env.BETTER_AUTH_SECRET as string);
		const hash = await crypto.subtle.digest("SHA-256", keyMaterial);
		return crypto.subtle.importKey("raw", hash, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
	})();

	return derivedKeyPromise;
};

/**
 * Encrypt plaintext using AES-256-GCM.
 * Returns a base64 string containing IV + ciphertext + auth tag.
 */
export const encrypt = (plaintext: string): Promise<string> =>
	encryptApiKey(plaintext, env.BETTER_AUTH_SECRET as string);

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
