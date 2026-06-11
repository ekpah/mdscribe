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

describe("context transfer handlers", () => {
	let server: TestServer;

	beforeEach(async () => {
		server = await startTestServer("context-transfers");
	});

	afterEach(async () => {
		await server?.close();
	});

	test("creates and consumes an encrypted transfer exactly once", async () => {
		const { user } = await createTestUser(server.db);
		const context = createTestContext({
			db: server.db,
			session: createMockSession(user),
		});
		const { token, tokenHash } = await createTokenPair();

		const created = await call(
			contextTransfersHandler.create,
			{
				ciphertext: "AQIDBAUGBwgJCgsMDQ4PEA",
				targetPath: "/aiscribe/discharge",
				tokenHash,
			},
			{ context },
		);

		expect(created.id).toBeTruthy();
		expect(created.expiresAt.getTime()).toBeGreaterThan(Date.now());

		const consumed = await call(
			contextTransfersHandler.consume,
			{
				targetPath: "/aiscribe/discharge",
				token,
			},
			{ context },
		);

		expect(consumed.ciphertext).toBe("AQIDBAUGBwgJCgsMDQ4PEA");

		// Consuming deletes the row, so the ciphertext is gone afterwards.
		const remaining = await server.db.query.contextTransfer.findFirst({
			where: eq(contextTransfer.tokenHash, tokenHash),
		});
		expect(remaining).toBeUndefined();

		await expect(
			call(
				contextTransfersHandler.consume,
				{ targetPath: "/aiscribe/discharge", token },
				{ context },
			),
		).rejects.toThrow("Transfer ist abgelaufen");
	});

	test("does not consume for another user or a wrong target path", async () => {
		const { user: owner } = await createTestUser(server.db, {
			email: "owner@example.com",
		});
		const { user: otherUser } = await createTestUser(server.db, {
			email: "other@example.com",
		});
		const ownerContext = createTestContext({
			db: server.db,
			session: createMockSession(owner),
		});
		const otherContext = createTestContext({
			db: server.db,
			session: createMockSession(otherUser),
		});
		const { token, tokenHash } = await createTokenPair();

		await call(
			contextTransfersHandler.create,
			{
				ciphertext: "AQIDBAUGBwgJCgsMDQ4PEA",
				targetPath: "/templates/template-id",
				tokenHash,
			},
			{ context: ownerContext },
		);

		await expect(
			call(
				contextTransfersHandler.consume,
				{ targetPath: "/templates/other-id", token },
				{ context: ownerContext },
			),
		).rejects.toThrow("Transfer ist abgelaufen");

		await expect(
			call(
				contextTransfersHandler.consume,
				{ targetPath: "/templates/template-id", token },
				{ context: otherContext },
			),
		).rejects.toThrow("Transfer ist abgelaufen");

		const consumed = await call(
			contextTransfersHandler.consume,
			{ targetPath: "/templates/template-id", token },
			{ context: ownerContext },
		);

		expect(consumed.targetPath).toBe("/templates/template-id");
	});

	test("expired transfers cannot be consumed and are cleaned up on create", async () => {
		const { user } = await createTestUser(server.db);
		const context = createTestContext({
			db: server.db,
			session: createMockSession(user),
		});
		const { token, tokenHash } = await createTokenPair();

		await call(
			contextTransfersHandler.create,
			{
				ciphertext: "AQIDBAUGBwgJCgsMDQ4PEA",
				targetPath: "/aiscribe/er",
				tokenHash,
			},
			{ context },
		);
		await server.db
			.update(contextTransfer)
			.set({ expiresAt: new Date(Date.now() - 1000) })
			.where(eq(contextTransfer.tokenHash, tokenHash));

		await expect(
			call(contextTransfersHandler.consume, { targetPath: "/aiscribe/er", token }, { context }),
		).rejects.toThrow("Transfer ist abgelaufen");

		const { tokenHash: nextTokenHash } = await createTokenPair();
		await call(
			contextTransfersHandler.create,
			{
				ciphertext: "AQIDBAUGBwgJCgsMDQ4PEA",
				targetPath: "/aiscribe/er",
				tokenHash: nextTokenHash,
			},
			{ context },
		);

		const expiredRow = await server.db.query.contextTransfer.findFirst({
			where: eq(contextTransfer.tokenHash, tokenHash),
		});
		expect(expiredRow).toBeUndefined();
	});

	test("rejects external or protocol-relative target paths", async () => {
		const { user } = await createTestUser(server.db);
		const context = createTestContext({
			db: server.db,
			session: createMockSession(user),
		});
		const { tokenHash } = await createTokenPair();

		for (const targetPath of ["https://evil.example", "//evil.example", "relative/path"]) {
			await expect(
				call(
					contextTransfersHandler.create,
					{ ciphertext: "AQIDBAUGBwgJCgsMDQ4PEA", targetPath, tokenHash },
					{ context },
				),
			).rejects.toThrow("Ungültiges Transfer-Ziel");
		}
	});
});
