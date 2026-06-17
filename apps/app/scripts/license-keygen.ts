/**
 * Generate an Ed25519 license signing keypair.
 *
 *   bun run apps/app/scripts/license-keygen.ts
 *
 * - Prints the PUBLIC key (raw, base64url) — paste it into
 *   `apps/app/lib/license/public-key.ts`. The public key is safe to commit.
 * - Writes the PRIVATE key (pkcs8, base64url) to
 *   `apps/app/.license-signing-key.local` (gitignored). Move it into your
 *   password manager and keep it OUT of the repo and any deployment. It is used
 *   only by `sign-license.ts` to mint license keys offline.
 *
 * Run this once. Regenerating invalidates every license key already issued.
 */

import { writeFileSync } from "node:fs";
import { join } from "node:path";

const toBase64Url = (buffer: ArrayBuffer): string => Buffer.from(buffer).toString("base64url");

const keyPair = (await crypto.subtle.generateKey({ name: "Ed25519" }, true, [
	"sign",
	"verify",
])) as CryptoKeyPair;

const rawPublicKey = await crypto.subtle.exportKey("raw", keyPair.publicKey);
const pkcs8PrivateKey = await crypto.subtle.exportKey("pkcs8", keyPair.privateKey);

const publicKeyB64Url = toBase64Url(rawPublicKey);
const privateKeyB64Url = toBase64Url(pkcs8PrivateKey);

const privateKeyPath = join(import.meta.dir, "..", ".license-signing-key.local");
writeFileSync(privateKeyPath, `${privateKeyB64Url}\n`, { mode: 0o600 });

process.stdout.write(
	[
		"",
		"Ed25519 license signing keypair generated.",
		"",
		"PUBLIC KEY (paste into apps/app/lib/license/public-key.ts):",
		publicKeyB64Url,
		"",
		`PRIVATE KEY written to: ${privateKeyPath}`,
		"Move it into your password manager and keep it out of the repo.",
		"",
	].join("\n"),
);
