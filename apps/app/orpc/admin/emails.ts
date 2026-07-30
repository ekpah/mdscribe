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
	userId: z.string().trim().min(1, "Nutzer ist erforderlich"),
});

const MARKETING_BROADCAST_CONFIRMATION = "MARKETING E-MAIL SENDEN";

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

const listEmailTestRecipientsHandler = adminEmailProcedure.handler(({ context }) =>
	context.db
		.select({
			email: user.email,
			emailVerified: user.emailVerified,
			id: user.id,
			name: user.name,
		})
		.from(user)
		.orderBy(asc(user.email)),
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
	.handler(async ({ context, input }) => {
		const parsed = parseWithBadRequest(sendTestInput, input);
		const draft = getDraftOrThrow(parsed.id);
		const subject = `[TEST] ${draft.subject}`;
		const [selectedUser] = await context.db
			.select({
				email: user.email,
				id: user.id,
				name: user.name,
			})
			.from(user)
			.where(eq(user.id, parsed.userId))
			.limit(1);

		if (!selectedUser) {
			throw new ORPCError("NOT_FOUND", {
				message: "Nutzer wurde nicht gefunden",
			});
		}

		await sendEmail({
			delivery: draft.category === "marketing" ? "broadcast" : "transactional",
			subject,
			template: draft.render({
				recipient: {
					email: selectedUser.email,
					name: selectedUser.name,
				},
			}),
			to: selectedUser.email,
		});

		return {
			id: draft.id,
			subject,
			to: selectedUser.email,
			userId: selectedUser.id,
			userName: selectedUser.name,
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

		const deliveryResult = await sendEmailBatch({
			delivery: "broadcast",
			subject: draft.subject,
			template: draft.render(),
			to: recipients,
		});

		return {
			acceptedCount: deliveryResult.acceptedCount,
			failedCount: deliveryResult.failedCount,
			id: draft.id,
			recipientCount: recipients.length,
			subject: draft.subject,
		};
	});

export const emailsHandler = {
	list: listEmailDraftsHandler,
	listTestRecipients: listEmailTestRecipientsHandler,
	preview: previewEmailDraftHandler,
	sendMarketingEmail: sendMarketingEmailHandler,
	sendTest: sendTestEmailDraftHandler,
};
