import { describe, expect, test } from "bun:test";

import {
	createTransferKey,
	createTransferToken,
	decryptTransferEnvelope,
	encryptTransferEnvelope,
	hashTransferToken,
	MAX_TRANSFER_ENVELOPE_CHARS,
	MAX_TRANSFER_PAYLOAD_BYTES,
	TransferPayloadTooLargeError,
} from "@/lib/context-transfer-crypto";

describe("context transfer crypto", () => {
	test("encrypts and decrypts a payload round-trip", async () => {
		const payload = {
			textContext: { epikrise: "Verlauf unauffällig.", notes: "Patient stabil." },
			version: 1,
		};

		const { envelope, key, payloadBytes } = await encryptTransferEnvelope(payload);
		expect(payloadBytes).toBeGreaterThan(0);
		expect(envelope).toMatch(/^[A-Za-z0-9_-]+$/);

		const decrypted = await decryptTransferEnvelope<typeof payload>(envelope, key);
		expect(decrypted).toEqual(payload);
	});

	test("encrypts with a key created on another device", async () => {
		const key = createTransferKey();
		const payload = { contextFiles: [{ name: "foto.jpg" }], version: 1 };
		const encrypted = await encryptTransferEnvelope(payload, key);

		expect(encrypted.key).toBe(key);
		expect(await decryptTransferEnvelope<typeof payload>(encrypted.envelope, key)).toEqual(payload);
	});

	test("fails to decrypt with a wrong key or tampered envelope", async () => {
		const { envelope, key } = await encryptTransferEnvelope({ secret: "value" });
		const { key: otherKey } = await encryptTransferEnvelope({ secret: "other" });

		await expect(decryptTransferEnvelope(envelope, otherKey)).rejects.toThrow();

		const tampered = `${envelope.slice(0, -2)}AA`;
		await expect(decryptTransferEnvelope(tampered, key)).rejects.toThrow();
	});

	test("rejects envelopes with an unknown version", async () => {
		const { key } = await encryptTransferEnvelope({ secret: "value" });
		// 0xFF version byte followed by enough bytes for an IV.
		await expect(decryptTransferEnvelope("_wAAAAAAAAAAAAAAAAAAAAAA", key)).rejects.toThrow(
			"Unsupported transfer envelope",
		);
	});

	test("rejects payloads above the limit; the server envelope cap covers the maximum payload", async () => {
		const oversized = { data: "x".repeat(MAX_TRANSFER_PAYLOAD_BYTES + 1) };
		await expect(encryptTransferEnvelope(oversized)).rejects.toThrow(TransferPayloadTooLargeError);

		// A maximal plaintext must still fit the server-side envelope cap after
		// IV/tag overhead and base64url expansion.
		const maxEnvelopeBytes = 1 + 12 + MAX_TRANSFER_PAYLOAD_BYTES + 16;
		expect(Math.ceil((maxEnvelopeBytes * 4) / 3)).toBeLessThanOrEqual(MAX_TRANSFER_ENVELOPE_CHARS);
	});

	test("hashes valid tokens deterministically and rejects short tokens", async () => {
		const token = createTransferToken();
		const first = await hashTransferToken(token);
		const second = await hashTransferToken(token);

		expect(first).toBeTruthy();
		expect(first).toBe(second as string);
		expect(await hashTransferToken("dG9vLXNob3J0")).toBeNull();
	});
});
