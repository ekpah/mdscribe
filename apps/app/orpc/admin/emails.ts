import { ORPCError, type } from "@orpc/server";
import {
	getEmailDraft,
	listEmailDraftMetadata,
	renderEmailDraftHtml,
} from "@repo/email/drafts";
import { sendEmail } from "@repo/email";
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

export const emailsHandler = {
	list: listEmailDraftsHandler,
	preview: previewEmailDraftHandler,
	sendTest: sendTestEmailDraftHandler,
};
