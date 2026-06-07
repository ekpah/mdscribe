import { render } from "@react-email/components";
import * as postmark from "postmark";
import type { ReactElement } from "react";

let client: postmark.ServerClient | null = null;

const getClient = (): postmark.ServerClient => {
	if (!client) {
		if (!process.env.AUTH_POSTMARK_KEY) {
			throw new Error("AUTH_POSTMARK_KEY is not set");
		}
		client = new postmark.ServerClient(process.env.AUTH_POSTMARK_KEY);
	}
	return client;
};

interface SendEmailOptions {
	from: string;
	to: string;
	subject: string;
	template: ReactElement;
}

interface SendEmailBatchOptions {
	from: string;
	to: readonly string[];
	subject: string;
	template: ReactElement;
}

const POSTMARK_BATCH_SIZE = 500;

const chunkArray = <T>(items: readonly T[], size: number): T[][] => {
	const chunks: T[][] = [];
	for (let index = 0; index < items.length; index += size) {
		chunks.push(items.slice(index, index + size));
	}
	return chunks;
};

export const sendEmail = async ({
	from,
	to,
	subject,
	template,
}: SendEmailOptions) => {
	const htmlBody = await render(template);

	return getClient().sendEmail({
		From: from,
		HtmlBody: htmlBody,
		Subject: subject,
		To: to,
	});
};

export const sendEmailBatch = async ({
	from,
	to,
	subject,
	template,
}: SendEmailBatchOptions) => {
	if (to.length === 0) {
		return [];
	}

	const htmlBody = await render(template);
	const messages: postmark.Message[] = to.map((recipient) => ({
		From: from,
		HtmlBody: htmlBody,
		Subject: subject,
		To: recipient,
	}));
	const responses: postmark.Models.MessageSendingResponse[] = [];

	for (const batch of chunkArray(messages, POSTMARK_BATCH_SIZE)) {
		const batchResponses = await getClient().sendEmailBatch(batch);
		responses.push(...batchResponses);
	}

	return responses;
};
