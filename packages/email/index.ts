import { render } from "@react-email/components";
import { createTransport } from "nodemailer";
import type { Transporter } from "nodemailer";
import type SMTPPool from "nodemailer/lib/smtp-pool";
import type { ReactElement } from "react";

export type EmailDelivery = "broadcast" | "transactional";

interface EmailSendResult {
	acceptedCount: number;
	messageId: string;
	rejectedCount: number;
}

export interface EmailBatchResult {
	acceptedCount: number;
	attemptedCount: number;
	failedCount: number;
}

const SMTP_MAX_CONNECTIONS = 5;
const SMTP_MAX_MESSAGES_PER_CONNECTION = 100;

interface SendEmailOptions {
	delivery?: EmailDelivery;
	subject: string;
	template: ReactElement;
	to: string;
}

interface SendEmailBatchOptions {
	delivery?: EmailDelivery;
	subject: string;
	template: ReactElement;
	to: readonly string[];
}

type SmtpTransporter = Transporter<SMTPPool.SentMessageInfo, SMTPPool.Options>;

let transactionalTransport: SmtpTransporter | null = null;
let broadcastTransport: SmtpTransporter | null = null;

const getRequiredEnvironmentValue = (name: string): string => {
	const value = process.env[name]?.trim();
	if (!value) {
		throw new Error(`${name} is required for email delivery`);
	}
	return value;
};

const createSmtpTransport = (url: string): SmtpTransporter => {
	const options: SMTPPool.Options & { maxRequeues: number } = {
		maxConnections: SMTP_MAX_CONNECTIONS,
		maxMessages: SMTP_MAX_MESSAGES_PER_CONNECTION,
		maxRequeues: 2,
		pool: true,
		url,
	};
	return createTransport(options);
};

const getTransactionalTransport = (): SmtpTransporter => {
	if (!transactionalTransport) {
		transactionalTransport = createSmtpTransport(getRequiredEnvironmentValue("MAIL_SMTP_URL"));
	}
	return transactionalTransport;
};

const getTransport = (delivery: EmailDelivery): SmtpTransporter => {
	const broadcastUrl = process.env.MAIL_BROADCAST_SMTP_URL?.trim();
	const transactionalUrl = getRequiredEnvironmentValue("MAIL_SMTP_URL");
	if (
		delivery !== "broadcast" ||
		!broadcastUrl ||
		broadcastUrl === transactionalUrl
	) {
		return getTransactionalTransport();
	}

	if (!broadcastTransport) {
		broadcastTransport = createSmtpTransport(broadcastUrl);
	}
	return broadcastTransport;
};

const countRecipients = (recipients: unknown): number =>
	Array.isArray(recipients) ? recipients.length : 0;

const getErrorCode = (error: unknown): string => {
	if (
		typeof error === "object" &&
		error !== null &&
		"code" in error &&
		typeof error.code === "string"
	) {
		return error.code;
	}
	return "UNKNOWN";
};

const sendRenderedEmail = async ({
	delivery,
	html,
	subject,
	to,
}: {
	delivery: EmailDelivery;
	html: string;
	subject: string;
	to: string;
}): Promise<EmailSendResult> => {
	const response = await getTransport(delivery).sendMail({
		disableFileAccess: true,
		disableUrlAccess: true,
		from: {
			address: getRequiredEnvironmentValue("MAIL_FROM_ADDRESS"),
			name: getRequiredEnvironmentValue("MAIL_FROM_NAME"),
		},
		html,
		subject,
		to,
	});
	const acceptedCount = countRecipients(response.accepted);
	const rejectedCount = countRecipients(response.rejected);

	if (acceptedCount === 0) {
		throw new Error("The SMTP relay did not accept the email recipient");
	}

	return {
		acceptedCount,
		messageId: response.messageId,
		rejectedCount,
	};
};

export const sendEmail = async ({
	delivery = "transactional",
	to,
	subject,
	template,
}: SendEmailOptions): Promise<EmailSendResult> => {
	const html = await render(template);
	return sendRenderedEmail({
		delivery,
		html,
		subject,
		to,
	});
};

export const sendEmailBatch = async ({
	delivery = "broadcast",
	to,
	subject,
	template,
}: SendEmailBatchOptions): Promise<EmailBatchResult> => {
	if (to.length === 0) {
		return {
			acceptedCount: 0,
			attemptedCount: 0,
			failedCount: 0,
		};
	}

	const html = await render(template);
	let acceptedCount = 0;
	let failedCount = 0;
	let nextRecipientIndex = 0;
	const failureCodes = new Map<string, number>();
	const workerCount = Math.min(SMTP_MAX_CONNECTIONS, to.length);

	const sendNext = async (): Promise<void> => {
		while (nextRecipientIndex < to.length) {
			const recipientIndex = nextRecipientIndex;
			nextRecipientIndex += 1;
			const recipient = to[recipientIndex];
			if (!recipient) {
				continue;
			}

			try {
				await sendRenderedEmail({
					delivery,
					html,
					subject,
					to: recipient,
				});
				acceptedCount += 1;
			} catch (error) {
				failedCount += 1;
				const code = getErrorCode(error);
				failureCodes.set(code, (failureCodes.get(code) ?? 0) + 1);
			}
		}
	};

	const workers: Promise<void>[] = [];
	for (let index = 0; index < workerCount; index += 1) {
		workers.push(sendNext());
	}
	await Promise.all(workers);

	if (failedCount > 0) {
		console.error("SMTP batch delivery failures", {
			failedCount,
			failureCodes: Object.fromEntries(failureCodes),
		});
	}

	return {
		acceptedCount,
		attemptedCount: to.length,
		failedCount,
	};
};

export const verifyEmailTransport = async (
	delivery: EmailDelivery = "transactional",
): Promise<void> => {
	await getTransport(delivery).verify();
};

export const closeEmailTransports = (): void => {
	broadcastTransport?.close();
	transactionalTransport?.close();
	broadcastTransport = null;
	transactionalTransport = null;
};
