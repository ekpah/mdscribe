import { afterAll, beforeAll, beforeEach, describe, expect, mock, test } from "bun:test";

import { createElement } from "react";
import { SMTPServer } from "smtp-server";

const mailEnv = {
	MAIL_BROADCAST_SMTP_URL: "",
	MAIL_FROM_ADDRESS: "noreply@example.com",
	MAIL_FROM_NAME: "MDScribe Test",
	MAIL_SMTP_URL: "",
};

mock.module("@repo/env", () => ({ env: mailEnv }));

const transactionalMessages: string[] = [];
const broadcastMessages: string[] = [];

const createTestServer = (messages: string[]): SMTPServer =>
	new SMTPServer({
		authOptional: true,
		disabledCommands: ["AUTH", "STARTTLS"],
		onData(stream, _session, callback) {
			const chunks: Buffer[] = [];
			stream.on("data", (chunk: Buffer) => {
				chunks.push(chunk);
			});
			stream.on("end", () => {
				messages.push(Buffer.concat(chunks).toString("utf8"));
				callback();
			});
		},
		onRcptTo(address, _session, callback) {
			if (address.address === "reject@example.com") {
				const error = new Error("Recipient rejected") as Error & {
					responseCode: number;
				};
				error.responseCode = 550;
				callback(error);
				return;
			}
			callback();
		},
	});

const listen = (server: SMTPServer): Promise<void> =>
	new Promise((resolve, reject) => {
		const handleError = (error: Error) => {
			reject(error);
		};
		server.once("error", handleError);
		server.listen(0, "127.0.0.1", () => {
			server.off("error", handleError);
			resolve();
		});
	});

const close = (server: SMTPServer): Promise<void> =>
	new Promise((resolve) => {
		server.close(resolve);
	});

const getPort = (server: SMTPServer): number => {
	const address = server.server.address();
	if (!address || typeof address === "string") {
		throw new Error("SMTP test server did not bind to a TCP port");
	}
	return address.port;
};

const transactionalServer = createTestServer(transactionalMessages);
const broadcastServer = createTestServer(broadcastMessages);

let emailModule: typeof import("./index") | undefined;

const getEmailModule = (): typeof import("./index") => {
	if (!emailModule) {
		throw new Error("Email module was not initialized");
	}
	return emailModule;
};

beforeAll(async () => {
	await Promise.all([listen(transactionalServer), listen(broadcastServer)]);
	mailEnv.MAIL_SMTP_URL = `smtp://127.0.0.1:${getPort(transactionalServer)}?ignoreTLS=true`;
	mailEnv.MAIL_BROADCAST_SMTP_URL = `smtp://127.0.0.1:${getPort(broadcastServer)}?ignoreTLS=true`;
	emailModule = await import("./index");
});

beforeEach(() => {
	transactionalMessages.length = 0;
	broadcastMessages.length = 0;
});

afterAll(async () => {
	emailModule?.closeEmailTransports();
	await Promise.all([close(transactionalServer), close(broadcastServer)]);
});

describe("SMTP email delivery", () => {
	test("sends transactional mail with the configured sender", async () => {
		const result = await getEmailModule().sendEmail({
			subject: "SMTP integration",
			template: createElement("p", null, "Transactional message"),
			to: "recipient@example.com",
		});

		expect(result.acceptedCount).toBe(1);
		expect(result.rejectedCount).toBe(0);
		expect(transactionalMessages).toHaveLength(1);
		expect(broadcastMessages).toHaveLength(0);
		expect(transactionalMessages[0]).toContain("From: MDScribe Test <noreply@example.com>");
		expect(transactionalMessages[0]).toContain("Transactional");
		expect(transactionalMessages[0]).toContain("message");
	});

	test("uses the optional broadcast transport for marketing mail", async () => {
		await getEmailModule().sendEmail({
			delivery: "broadcast",
			subject: "Broadcast integration",
			template: createElement("p", null, "Broadcast message"),
			to: "recipient@example.com",
		});

		expect(transactionalMessages).toHaveLength(0);
		expect(broadcastMessages).toHaveLength(1);
		expect(broadcastMessages[0]).toContain("Broadcast");
		expect(broadcastMessages[0]).toContain("message");
	});

	test("isolates recipients and reports partial batch failures", async () => {
		const result = await getEmailModule().sendEmailBatch({
			subject: "Batch integration",
			template: createElement("p", null, "Batch message"),
			to: ["accepted@example.com", "reject@example.com"],
		});

		expect(result).toEqual({
			acceptedCount: 1,
			attemptedCount: 2,
			failedCount: 1,
		});
		expect(broadcastMessages).toHaveLength(1);
		expect(broadcastMessages[0]).toContain("To: accepted@example.com");
		expect(broadcastMessages[0]).not.toContain("reject@example.com");
	});

	test("verifies both configured SMTP transports", async () => {
		await expect(getEmailModule().verifyEmailTransport()).resolves.toBeUndefined();
		await expect(getEmailModule().verifyEmailTransport("broadcast")).resolves.toBeUndefined();
	});
});
