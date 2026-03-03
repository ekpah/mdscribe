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
