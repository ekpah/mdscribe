/** Framework-independent AES-256-GCM: base64 encoded IV (12 bytes) + ciphertext + auth tag. */
export const encryptApiKey = async (plaintext: string, secret: string): Promise<string> => {
	if (!secret.trim()) {
		throw new Error("BETTER_AUTH_SECRET is required to encrypt API keys.");
	}
	const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
	const key = await crypto.subtle.importKey("raw", hash, { name: "AES-GCM" }, false, ["encrypt"]);
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const ciphertext = await crypto.subtle.encrypt(
		{ iv, name: "AES-GCM", tagLength: 128 },
		key,
		new TextEncoder().encode(plaintext),
	);
	const combined = new Uint8Array(iv.length + ciphertext.byteLength);
	combined.set(iv);
	combined.set(new Uint8Array(ciphertext), iv.length);
	return Buffer.from(combined).toString("base64");
};
