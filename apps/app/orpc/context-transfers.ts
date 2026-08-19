import { ORPCError } from "@orpc/server";
import { and, contextTransfer, eq, gt, lt, ne } from "@repo/database";
import { z } from "zod";

import { hashTransferToken, MAX_TRANSFER_ENVELOPE_CHARS } from "@/lib/context-transfer-crypto";
import { authed, pub } from "@/orpc";

const TRANSFER_TTL_SECONDS = 10 * 60;
const MOBILE_UPLOAD_TARGET = "/mobile-upload";
// ContextTransfer requires ciphertext at creation time. This reserved value
// represents an empty mobile slot and can never be a valid AES-GCM envelope.
const MOBILE_UPLOAD_PENDING = "pending";

const base64UrlSchema = z.string().regex(/^[A-Za-z0-9_-]+$/);
const tokenHashSchema = base64UrlSchema.min(32).max(64);
const tokenSchema = base64UrlSchema.min(32).max(128);

const createTransferInput = z.object({
	ciphertext: base64UrlSchema.max(MAX_TRANSFER_ENVELOPE_CHARS),
	targetPath: z.string().min(1).max(512),
	tokenHash: tokenHashSchema,
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

const createMobileHandler = authed
	.input(z.object({ tokenHash: tokenHashSchema }))
	.handler(async ({ context, input }) => {
		const now = new Date();
		await context.db.delete(contextTransfer).where(lt(contextTransfer.expiresAt, now));

		const [created] = await context.db
			.insert(contextTransfer)
			.values({
				ciphertext: MOBILE_UPLOAD_PENDING,
				expiresAt: new Date(now.getTime() + TRANSFER_TTL_SECONDS * 1000),
				targetPath: MOBILE_UPLOAD_TARGET,
				tokenHash: input.tokenHash,
				userId: context.session.user.id,
			})
			.returning({ expiresAt: contextTransfer.expiresAt });

		if (!created) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: "Mobiler Upload konnte nicht erstellt werden.",
			});
		}

		return created;
	});

const uploadMobileHandler = pub
	.input(
		z.object({
			ciphertext: base64UrlSchema.max(MAX_TRANSFER_ENVELOPE_CHARS),
			uploadToken: tokenSchema,
		}),
	)
	.handler(async ({ context, input }) => {
		const tokenHash = await hashTransferToken(input.uploadToken);
		if (!tokenHash) {
			throw new ORPCError("BAD_REQUEST", { message: "Ungültiger Upload-Code." });
		}

		const [uploaded] = await context.db
			.update(contextTransfer)
			.set({ ciphertext: input.ciphertext })
			.where(
				and(
					eq(contextTransfer.tokenHash, tokenHash),
					eq(contextTransfer.targetPath, MOBILE_UPLOAD_TARGET),
					eq(contextTransfer.ciphertext, MOBILE_UPLOAD_PENDING),
					gt(contextTransfer.expiresAt, new Date()),
				),
			)
			.returning({ expiresAt: contextTransfer.expiresAt });

		if (!uploaded) {
			throw new ORPCError("NOT_FOUND", {
				message: "Der Upload ist abgelaufen, wurde bereits verwendet oder ist ungültig.",
			});
		}

		return uploaded;
	});

const hashMobileToken = async (token: string) => {
	const tokenHash = await hashTransferToken(token);
	if (!tokenHash) {
		throw new ORPCError("BAD_REQUEST", { message: "Ungültiger Abruf-Code." });
	}
	return tokenHash;
};

const mobileStatusHandler = authed
	.input(z.object({ token: tokenSchema }))
	.handler(async ({ context, input }) => {
		const tokenHash = await hashMobileToken(input.token);
		const slot = await context.db.query.contextTransfer.findFirst({
			columns: { ciphertext: true, expiresAt: true },
			where: and(
				eq(contextTransfer.tokenHash, tokenHash),
				eq(contextTransfer.userId, context.session.user.id),
				eq(contextTransfer.targetPath, MOBILE_UPLOAD_TARGET),
				gt(contextTransfer.expiresAt, new Date()),
			),
		});

		if (!slot) {
			throw new ORPCError("NOT_FOUND", { message: "Der mobile Upload ist abgelaufen." });
		}

		return { expiresAt: slot.expiresAt, ready: slot.ciphertext !== MOBILE_UPLOAD_PENDING };
	});

const consumeMobileHandler = authed
	.input(z.object({ token: tokenSchema }))
	.handler(async ({ context, input }) => {
		const tokenHash = await hashMobileToken(input.token);
		const [consumed] = await context.db
			.delete(contextTransfer)
			.where(
				and(
					eq(contextTransfer.tokenHash, tokenHash),
					eq(contextTransfer.userId, context.session.user.id),
					eq(contextTransfer.targetPath, MOBILE_UPLOAD_TARGET),
					gt(contextTransfer.expiresAt, new Date()),
					ne(contextTransfer.ciphertext, MOBILE_UPLOAD_PENDING),
				),
			)
			.returning({ ciphertext: contextTransfer.ciphertext });

		if (!consumed) {
			throw new ORPCError("NOT_FOUND", {
				message: "Das Foto ist noch nicht verfügbar oder der Upload ist abgelaufen.",
			});
		}

		return consumed;
	});

export const contextTransfersHandler = {
	consume: consumeHandler,
	consumeMobile: consumeMobileHandler,
	create: createHandler,
	createMobile: createMobileHandler,
	mobileStatus: mobileStatusHandler,
	uploadMobile: uploadMobileHandler,
};
