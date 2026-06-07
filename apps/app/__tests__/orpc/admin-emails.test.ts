import type { mock } from "bun:test";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { ORPCError, call } from "@orpc/server";
import { user } from "@repo/database";
import { sendEmail, sendEmailBatch } from "@repo/email";
import { emailDraftIds } from "@repo/email/drafts";

import { ADMIN_EMAIL, createTestContext, createTestUser, startTestServer } from "@/__tests__/setup";
import type { TestServer } from "@/__tests__/setup";
import { emailsHandler } from "@/orpc/admin/emails";

const sendEmailMock = sendEmail as unknown as ReturnType<typeof mock>;
const sendEmailBatchMock = sendEmailBatch as unknown as ReturnType<typeof mock>;

describe("Admin emails handler", () => {
	let server: TestServer;
	let context: ReturnType<typeof createTestContext>;

	beforeEach(async () => {
		server = await startTestServer("admin-emails");
		const { session } = await createTestUser(server.db, { email: ADMIN_EMAIL });
		context = createTestContext({ db: server.db, session });
		sendEmailMock.mockClear();
		sendEmailBatchMock.mockClear();
	});

	afterEach(async () => {
		await server?.close();
	});

	test("registry contains all current drafts", () => {
		expect(emailDraftIds.toSorted()).toEqual([
			"ai-texts-announcement",
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
		const aiTextsDraft = drafts.find((draft) => draft.id === "ai-texts-announcement");
		const documentsDraft = drafts.find((draft) => draft.id === "documents-announcement");

		expect(drafts).toHaveLength(emailDraftIds.length);
		expect(aiTextsDraft?.title).toBe("AI-Scribe: AI Textbausteine");
		expect(aiTextsDraft?.subject).toContain("AI Textbausteine");
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

	test("preview renders AI Textbausteine announcement HTML", async () => {
		const preview = await call(
			emailsHandler.preview,
			{ id: "ai-texts-announcement" },
			{ context },
		);

		expect(preview.id).toBe("ai-texts-announcement");
		expect(preview.html).toContain("<html");
		expect(preview.html).toContain("Standardvorlage");
		expect(preview.html).toContain("Eigenes Template erstellen");
		expect(preview.html).toContain("AI Textbaustein daraus erstellen");
		expect(preview.html).toContain("Kurzbrief aus der Notaufnahme");
		expect(preview.html).toContain("Brief Spezialambulanz");
		expect(preview.html).toContain("Befund Herzkatheter");
		expect(preview.html).toContain("Template erstellen");
		expect(preview.html).toContain("AI Textbaustein erstellen");
		expect(preview.html).toContain("AI-Scribe");
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

	test("sendMarketingEmail rejects missing confirmation before selecting recipients", async () => {
		await expect(
			call(
				emailsHandler.sendMarketingEmail,
				{ confirmation: "falsch", id: "documents-announcement" },
				{ context },
			),
		).rejects.toThrow("Bestätigung stimmt nicht");

		expect(sendEmailBatchMock).not.toHaveBeenCalled();
	});

	test("sendMarketingEmail rejects non-marketing drafts", async () => {
		await expect(
			call(
				emailsHandler.sendMarketingEmail,
				{ confirmation: "MARKETING E-MAIL SENDEN", id: "welcome" },
				{ context },
			),
		).rejects.toThrow("Nur Marketing-E-Mail-Entwürfe");

		expect(sendEmailBatchMock).not.toHaveBeenCalled();
	});

	test("sendMarketingEmail sends a selected marketing draft to verified users via batch", async () => {
		await createTestUser(server.db, { email: "verified@example.com" });
		await server.db.insert(user).values({
			email: "unverified@example.com",
			emailVerified: false,
			id: crypto.randomUUID(),
			name: "Unverified User",
		});

		const result = await call(
			emailsHandler.sendMarketingEmail,
			{ confirmation: "MARKETING E-MAIL SENDEN", id: "documents-announcement" },
			{ context },
		);

		expect(result).toMatchObject({
			batchCount: 1,
			id: "documents-announcement",
			recipientCount: 2,
			submittedCount: 2,
		});
		expect(result.subject).toContain("Rehaanträge");
		expect(sendEmailBatchMock).toHaveBeenCalledTimes(1);
		const batchOptions = sendEmailBatchMock.mock.calls[0]?.[0] as
			| { subject: string; to: string[] }
			| undefined;
		expect(batchOptions?.subject).toContain("Rehaanträge");
		expect(batchOptions?.to.toSorted()).toEqual(["admin@test.com", "verified@example.com"]);
	});
});
