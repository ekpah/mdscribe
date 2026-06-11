"use client";

import {
	createTransferToken,
	decryptTransferEnvelope,
	encryptTransferEnvelope,
	hashTransferToken,
} from "@/lib/context-transfer-crypto";
import { orpc } from "@/lib/orpc";
import type { ContextTransferPayload } from "./types";

export const createContextTransferLaunchUrl = async ({
	payload,
	targetPath,
}: {
	payload: ContextTransferPayload;
	targetPath: string;
}): Promise<string> => {
	const token = createTransferToken();
	const tokenHash = await hashTransferToken(token);
	if (!tokenHash) {
		throw new Error("Invalid transfer token");
	}

	const { envelope, key } = await encryptTransferEnvelope(payload);
	await orpc.contextTransfers.create.call({
		ciphertext: envelope,
		targetPath,
		tokenHash,
	});

	const [pathWithoutHash] = targetPath.split("#");
	const fragment = new URLSearchParams({ contextTransfer: token, key });
	return `${pathWithoutHash}#${fragment.toString()}`;
};

const parseContextTransferFragment = (): { key: string; token: string } | null => {
	if (typeof window === "undefined" || !window.location.hash) {
		return null;
	}

	const fragment = new URLSearchParams(window.location.hash.slice(1));
	const token = fragment.get("contextTransfer");
	const key = fragment.get("key");
	if (!token || !key) {
		return null;
	}

	return { key, token };
};

const clearContextTransferFragment = () => {
	const nextUrl = `${window.location.pathname}${window.location.search}`;
	window.history.replaceState(window.history.state, "", nextUrl);
};

// Tokens are one-time; guard against duplicate consumes from re-running
// effects (StrictMode, unstable hook deps) while the request is in flight.
const startedTokens = new Set<string>();

export const consumeContextTransferFromFragment =
	async (): Promise<ContextTransferPayload | null> => {
		const fragment = parseContextTransferFragment();
		if (!fragment || startedTokens.has(fragment.token)) {
			return null;
		}

		startedTokens.add(fragment.token);
		try {
			const transfer = await orpc.contextTransfers.consume.call({
				targetPath: window.location.pathname,
				token: fragment.token,
			});
			const payload = await decryptTransferEnvelope<ContextTransferPayload>(
				transfer.ciphertext,
				fragment.key,
			);
			clearContextTransferFragment();
			return payload;
		} catch (error) {
			startedTokens.delete(fragment.token);
			throw error;
		}
	};
