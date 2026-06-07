import { ORPCError, type } from "@orpc/server";
import { asc, eq, user } from "@repo/database";
import {
	getEmailDraft,
	listEmailDraftMetadata,
	renderEmailDraftHtml,
} from "@repo/email/drafts";
import { sendEmail, sendEmailBatch } from "@repo/email";
import { z } from "zod";

import { authed } from "@/orpc";
import { requiredAdminMiddleware } from "@/orpc/middlewares/admin";

const draftIdInput = z.object({
	id: z.string().trim().min(1, "E-Mail-Entwurf ist erforderlich"),
});

const sendTestInput = draftIdInput.extend({
	to: z
		.string()
		.trim()
		.email("Bitte eine gültige E-Mail-Adresse eingeben"),
});

const MARKETING_BROADCAST_CONFIRMATION = "MARKETING E-MAIL SENDEN";
const POSTMARK_BATCH_SIZE = 500;

const sendMarketingEmailInput = draftIdInput.extend({
	confirmation: z.string().trim().min(1, "Bestätigung ist erforderlich"),
});

const parseWithBadRequest = <T>(schema: z.ZodType<T>, input: unknown): T => {
	const parsed = schema.safeParse(input);
	if (!parsed.success) {
		throw new ORPCError("BAD_REQUEST", {
			message: parsed.error.issues[0]?.message ?? "Ungültige Eingabe",
		});
	}

	return parsed.data;
};

const getDraftOrThrow = (id: string) => {
	const draft = getEmailDraft(id);
	if (!draft) {
		throw new ORPCError("NOT_FOUND", {
			message: "E-Mail-Entwurf wurde nicht gefunden",
		});
	}

	return draft;
};

const dedupeEmails = (emails: readonly string[]): string[] => {
	const emailsByNormalizedValue = new Map<string, string>();

	for (const email of emails) {
		const trimmedEmail = email.trim();
		const normalizedEmail = trimmedEmail.toLowerCase();
		if (trimmedEmail && !emailsByNormalizedValue.has(normalizedEmail)) {
			emailsByNormalizedValue.set(normalizedEmail, trimmedEmail);
		}
	}

	return [...emailsByNormalizedValue.values()];
};

const adminEmailProcedure = authed.use(requiredAdminMiddleware);

const listEmailDraftsHandler = adminEmailProcedure.handler(() =>
	listEmailDraftMetadata(),
);

const previewEmailDraftHandler = adminEmailProcedure
	.input(type<z.infer<typeof draftIdInput>>())
	.handler(async ({ input }) => {
		const parsed = parseWithBadRequest(draftIdInput, input);
		getDraftOrThrow(parsed.id);

		const html = await renderEmailDraftHtml(parsed.id);
		if (!html) {
			throw new ORPCError("NOT_FOUND", {
				message: "E-Mail-Entwurf wurde nicht gefunden",
			});
		}

		return {
			html,
			id: parsed.id,
		};
	});

const sendTestEmailDraftHandler = adminEmailProcedure
	.input(type<z.infer<typeof sendTestInput>>())
	.handler(async ({ input }) => {
		const parsed = parseWithBadRequest(sendTestInput, input);
		const draft = getDraftOrThrow(parsed.id);
		const subject = `[TEST] ${draft.subject}`;

		await sendEmail({
			from: "noreply@mdscribe.de",
			subject,
			template: draft.render(),
			to: parsed.to,
		});

		return {
			id: draft.id,
			subject,
			to: parsed.to,
		};
	});

const sendMarketingEmailHandler = adminEmailProcedure
	.input(type<z.infer<typeof sendMarketingEmailInput>>())
	.handler(async ({ context, input }) => {
		const parsed = parseWithBadRequest(sendMarketingEmailInput, input);
		if (parsed.confirmation !== MARKETING_BROADCAST_CONFIRMATION) {
			throw new ORPCError("BAD_REQUEST", {
				message: "Bestätigung stimmt nicht mit dem erwarteten Text überein",
			});
		}

		const draft = getDraftOrThrow(parsed.id);
		if (draft.category !== "marketing") {
			throw new ORPCError("BAD_REQUEST", {
				message: "Nur Marketing-E-Mail-Entwürfe können als Broadcast versendet werden",
			});
		}

		const recipientRows = await context.db
			.select({ email: user.email })
			.from(user)
			.where(eq(user.emailVerified, true))
			.orderBy(asc(user.email));
		const recipients = dedupeEmails(recipientRows.map((row) => row.email));

		const responses = await sendEmailBatch({
			from: "noreply@mdscribe.de",
			subject: draft.subject,
			template: draft.render(),
			to: recipients,
		});

		return {
			batchCount:
				recipients.length === 0 ? 0 : Math.ceil(recipients.length / POSTMARK_BATCH_SIZE),
			id: draft.id,
			recipientCount: recipients.length,
			subject: draft.subject,
			submittedCount: responses.length,
		};
	});

export const emailsHandler = {
	list: listEmailDraftsHandler,
	preview: previewEmailDraftHandler,
	sendMarketingEmail: sendMarketingEmailHandler,
	sendTest: sendTestEmailDraftHandler,
};
