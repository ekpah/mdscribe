import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { call } from "@orpc/server";
import { contextTransfer, eq } from "@repo/database";

import type { TestServer } from "@/__tests__/setup";
import {
	createMockSession,
	createTestContext,
	createTestUser,
	startTestServer,
} from "@/__tests__/setup";
import { createTransferToken, hashTransferToken } from "@/lib/context-transfer-crypto";
import { contextTransfersHandler } from "@/orpc/context-transfers";

const createTokenPair = async () => {
	const token = createTransferToken();
	const tokenHash = await hashTransferToken(token);
	if (!tokenHash) {
		throw new Error("token hashing failed");
	}
	return { token, tokenHash };
};

describe("mobile context upload handlers", () => {
	let server: TestServer;

	beforeEach(async () => {
		server = await startTestServer("mobile-context-uploads");
	});

	afterEach(async () => {
		await server?.close();
	});

	test("reuses a context transfer for one anonymous upload and owner consumption", async () => {
		const { user } = await createTestUser(server.db);
		const ownerContext = createTestContext({
			db: server.db,
			session: createMockSession(user),
		});
		const publicContext = createTestContext({ db: server.db });
		const transfer = await createTokenPair();

		await call(
			contextTransfersHandler.createMobile,
			{ tokenHash: transfer.tokenHash },
			{ context: ownerContext },
		);
		expect(
			await call(
				contextTransfersHandler.mobileStatus,
				{ token: transfer.token },
				{ context: ownerContext },
			),
		).toMatchObject({ ready: false });

		await call(
			contextTransfersHandler.uploadMobile,
			{ ciphertext: "AQIDBAUGBwgJCgsMDQ4PEA", uploadToken: transfer.token },
			{ context: publicContext },
		);
		expect(
			await call(
				contextTransfersHandler.mobileStatus,
				{ token: transfer.token },
				{ context: ownerContext },
			),
		).toMatchObject({ ready: true });

		const result = await call(
			contextTransfersHandler.consumeMobile,
			{ token: transfer.token },
			{ context: ownerContext },
		);
		expect(result.ciphertext).toBe("AQIDBAUGBwgJCgsMDQ4PEA");
		expect(
			await server.db.query.contextTransfer.findFirst({
				where: eq(contextTransfer.tokenHash, transfer.tokenHash),
			}),
		).toBeUndefined();
	});

	test("rejects a second upload and consumption by another user", async () => {
		const { user: owner } = await createTestUser(server.db, { email: "owner-mobile@example.com" });
		const { user: other } = await createTestUser(server.db, { email: "other-mobile@example.com" });
		const ownerContext = createTestContext({ db: server.db, session: createMockSession(owner) });
		const otherContext = createTestContext({ db: server.db, session: createMockSession(other) });
		const publicContext = createTestContext({ db: server.db });
		const transfer = await createTokenPair();

		await call(
			contextTransfersHandler.createMobile,
			{ tokenHash: transfer.tokenHash },
			{ context: ownerContext },
		);
		await call(
			contextTransfersHandler.uploadMobile,
			{ ciphertext: "AQIDBAUGBwgJCgsMDQ4PEA", uploadToken: transfer.token },
			{ context: publicContext },
		);

		await expect(
			call(
				contextTransfersHandler.uploadMobile,
				{ ciphertext: "AQIDBAUGBwgJCgsMDQ4PEB", uploadToken: transfer.token },
				{ context: publicContext },
			),
		).rejects.toThrow("bereits verwendet");
		await expect(
			call(
				contextTransfersHandler.consumeMobile,
				{ token: transfer.token },
				{ context: otherContext },
			),
		).rejects.toThrow("noch nicht verfügbar");

		expect(
			await call(
				contextTransfersHandler.consumeMobile,
				{ token: transfer.token },
				{ context: ownerContext },
			),
		).toMatchObject({ ciphertext: "AQIDBAUGBwgJCgsMDQ4PEA" });
	});
});
