import { ORPCError } from "@orpc/server";
import { and, contextTransfer, eq, gt, lt } from "@repo/database";
import { z } from "zod";

import { hashTransferToken, MAX_TRANSFER_ENVELOPE_CHARS } from "@/lib/context-transfer-crypto";
import { authed } from "@/orpc";

const TRANSFER_TTL_SECONDS = 10 * 60;

const base64UrlSchema = z.string().regex(/^[A-Za-z0-9_-]+$/);

const createTransferInput = z.object({
	ciphertext: base64UrlSchema.max(MAX_TRANSFER_ENVELOPE_CHARS),
	targetPath: z.string().min(1).max(512),
	tokenHash: base64UrlSchema.min(32).max(64),
});

const consumeTransferInput = z.object({
	targetPath: z.string().min(1).max(512),
	token: base64UrlSchema.max(128),
});

const assertInternalTargetPath = (targetPath: string) => {
	if (!targetPath.startsWith("/") || targetPath.startsWith("//") || targetPath.includes("://")) {
		throw new ORPCError("BAD_REQUEST", {
			message: "Ungültiges Transfer-Ziel.",
		});
	}
};

const createHandler = authed.input(createTransferInput).handler(async ({ context, input }) => {
	assertInternalTargetPath(input.targetPath);

	const now = new Date();
	await context.db.delete(contextTransfer).where(lt(contextTransfer.expiresAt, now));

	const [created] = await context.db
		.insert(contextTransfer)
		.values({
			ciphertext: input.ciphertext,
			expiresAt: new Date(now.getTime() + TRANSFER_TTL_SECONDS * 1000),
			targetPath: input.targetPath,
			tokenHash: input.tokenHash,
			userId: context.session.user.id,
		})
		.returning({
			expiresAt: contextTransfer.expiresAt,
			id: contextTransfer.id,
		});

	if (!created) {
		throw new ORPCError("INTERNAL_SERVER_ERROR", {
			message: "Transfer konnte nicht erstellt werden.",
		});
	}

	return created;
});

const consumeHandler = authed.input(consumeTransferInput).handler(async ({ context, input }) => {
	const tokenHash = await hashTransferToken(input.token);
	if (!tokenHash) {
		throw new ORPCError("BAD_REQUEST", {
			message: "Ungültiger Transfer-Code.",
		});
	}

	// Deleting on consume enforces one-time use atomically and leaves no
	// ciphertext behind once the payload has been handed over.
	const [consumed] = await context.db
		.delete(contextTransfer)
		.where(
			and(
				eq(contextTransfer.tokenHash, tokenHash),
				eq(contextTransfer.userId, context.session.user.id),
				eq(contextTransfer.targetPath, input.targetPath),
				gt(contextTransfer.expiresAt, new Date()),
			),
		)
		.returning({
			ciphertext: contextTransfer.ciphertext,
			targetPath: contextTransfer.targetPath,
		});

	if (!consumed) {
		throw new ORPCError("NOT_FOUND", {
			message: "Transfer ist abgelaufen, bereits verwendet oder nicht verfügbar.",
		});
	}

	return consumed;
});

export const contextTransfersHandler = {
	consume: consumeHandler,
	create: createHandler,
};
