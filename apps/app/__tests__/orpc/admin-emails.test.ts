import type { mock } from "bun:test";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { ORPCError, call } from "@orpc/server";
import { sendEmail } from "@repo/email";
import { emailDraftIds } from "@repo/email/drafts";

import { ADMIN_EMAIL, createTestContext, createTestUser, startTestServer } from "@/__tests__/setup";
import type { TestServer } from "@/__tests__/setup";
import { emailsHandler } from "@/orpc/admin/emails";

const sendEmailMock = sendEmail as unknown as ReturnType<typeof mock>;

describe("Admin emails handler", () => {
	let server: TestServer;
	let context: ReturnType<typeof createTestContext>;

	beforeEach(async () => {
		server = await startTestServer("admin-emails");
		const { session } = await createTestUser(server.db, { email: ADMIN_EMAIL });
		context = createTestContext({ db: server.db, session });
		sendEmailMock.mockClear();
	});

	afterEach(async () => {
		await server?.close();
	});

	test("registry contains all current drafts", () => {
		expect(emailDraftIds.toSorted()).toEqual([
			"change-email",
			"cold-outreach",
			"documents-announcement",
			"otp-login",
			"reset-password",
			"verify",
			"welcome",
		]);
	});

	test("lists draft metadata without render functions", async () => {
		const drafts = await call(emailsHandler.list, undefined, { context });
		const documentsDraft = drafts.find((draft) => draft.id === "documents-announcement");

		expect(drafts).toHaveLength(emailDraftIds.length);
		expect(documentsDraft?.title).toBe("Dokumente: Rehaantrag");
		expect(documentsDraft?.subject).toContain("Rehaanträge");
		expect(documentsDraft).not.toHaveProperty("render");
	});

	test("preview renders non-empty HTML", async () => {
		const preview = await call(
			emailsHandler.preview,
			{ id: "documents-announcement" },
			{ context },
		);

		expect(preview.id).toBe("documents-announcement");
		expect(preview.html).toContain("<html");
		expect(preview.html).toContain("DRV Rehaantrag");
	});

	test("preview rejects invalid draft ids", async () => {
		await expect(call(emailsHandler.preview, { id: "missing-draft" }, { context })).rejects.toThrow(
			ORPCError,
		);
	});

	test("sendTest validates recipient email before sending", async () => {
		await expect(
			call(
				emailsHandler.sendTest,
				{ id: "documents-announcement", to: "not-an-email" },
				{ context },
			),
		).rejects.toThrow("gültige E-Mail-Adresse");

		expect(sendEmailMock).not.toHaveBeenCalled();
	});

	test("sendTest sends a single test email with prefixed subject", async () => {
		const result = await call(
			emailsHandler.sendTest,
			{ id: "documents-announcement", to: "nils@example.com" },
			{ context },
		);

		expect(result).toEqual({
			id: "documents-announcement",
			subject: "[TEST] Neu: Rehaanträge schneller mit MDScribe vorbereiten",
			to: "nils@example.com",
		});
		expect(sendEmailMock).toHaveBeenCalledTimes(1);
		expect(sendEmailMock.mock.calls[0]?.[0]).toMatchObject({
			from: "noreply@mdscribe.de",
			subject: "[TEST] Neu: Rehaanträge schneller mit MDScribe vorbereiten",
			to: "nils@example.com",
		});
	});
});
