import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { call } from "@orpc/server";

import type { TestServer } from "@/__tests__/setup";
import {
	ADMIN_EMAIL,
	createMockSession,
	createTestAiDefaults,
	createTestContext,
	createTestSubscription,
	createTestTemplate,
	createTestUser,
	startTestServer,
} from "@/__tests__/setup";
import { getBuiltInAiscribeOverrideSlug } from "@/lib/aiscribe-built-ins";
import { scribeFormsHandler as adminScribeFormsHandler } from "@/orpc/admin/scribe-forms";
import { scribeFormsHandler } from "@/orpc/scribe-forms";

describe("AI Scribe Forms Handlers", () => {
	let server: TestServer;
	let adminContext: ReturnType<typeof createTestContext>;
	let ownerContext: ReturnType<typeof createTestContext>;
	let otherUserContext: ReturnType<typeof createTestContext>;
	let publicContext: ReturnType<typeof createTestContext>;
	let ownerUserId: string;
	let otherUserId: string;
	let templateId: string;
	let privateTemplateId: string;

	beforeEach(async () => {
		server = await startTestServer("scribe-forms");
		const { user: adminUser } = await createTestUser(server.db, {
			email: ADMIN_EMAIL,
		});
		const { user: authorUser } = await createTestUser(server.db, {
			email: "doctor@test.com",
			name: "Dr. Clara Autorin",
		});
		const { user: otherUser } = await createTestUser(server.db, {
			email: "other-doctor@test.com",
		});
		const session = createMockSession(adminUser);
		const ownerSession = createMockSession(authorUser);
		const otherSession = createMockSession(otherUser);
		await createTestAiDefaults(server.db);
		const template = await createTestTemplate(server.db, authorUser.id, {
			title: "Briefvorlage",
		});
		const privateTemplate = await createTestTemplate(server.db, authorUser.id, {
			title: "Private Briefvorlage",
			visibility: "private",
		});

		ownerUserId = authorUser.id;
		otherUserId = otherUser.id;
		templateId = template.id;
		privateTemplateId = privateTemplate.id;
		adminContext = createTestContext({ db: server.db, session });
		ownerContext = createTestContext({ db: server.db, session: ownerSession });
		otherUserContext = createTestContext({ db: server.db, session: otherSession });
		publicContext = createTestContext({ db: server.db });
	});

	afterEach(async () => {
		await server?.close();
	});

	test("admin can create and list custom AI forms", async () => {
		const created = await call(
			adminScribeFormsHandler.create,
			{
				description: "Erstellt einen strukturierten Echo-Brief.",
				enabled: true,
				name: "Echo Brief",
				promptHarness: "Inpatient_discharge",
				slug: "echo-brief",
				templateId,
			},
			{ context: adminContext },
		);

		const listed = await call(adminScribeFormsHandler.list, undefined, {
			context: adminContext,
		});
		const publicForm = await call(
			scribeFormsHandler.getBySlug,
			{ slug: "echo-brief" },
			{ context: publicContext },
		);

		expect(created.slug).toBe("echo-brief");
		expect(created.promptHarness).toBe("discharge");
		expect(listed).toHaveLength(1);
		expect(listed[0]?.template?.id).toBe(templateId);
		expect(publicForm?.name).toBe("Echo Brief");
		expect(publicForm?.author).toBeNull();
	});

	test("disabled custom AI forms are hidden from public reads", async () => {
		const created = await call(
			adminScribeFormsHandler.create,
			{
				description: null,
				enabled: true,
				name: "Echo Brief",
				promptHarness: "Diagnoses",
				slug: "echo-brief",
				templateId: null,
			},
			{ context: adminContext },
		);

		await call(
			adminScribeFormsHandler.update,
			{
				description: null,
				enabled: false,
				id: created.id,
				name: "Echo Brief",
				promptHarness: "Diagnoses",
				slug: "echo-brief",
				templateId: null,
			},
			{ context: adminContext },
		);

		const listed = await call(scribeFormsHandler.listAvailable, undefined, {
			context: publicContext,
		});
		const publicForm = await call(
			scribeFormsHandler.getBySlug,
			{ slug: "echo-brief" },
			{ context: publicContext },
		);

		expect(listed).toEqual([]);
		expect(publicForm).toBeNull();
	});

	test("built-in overrides stay out of custom listings but are available by slug", async () => {
		await call(
			adminScribeFormsHandler.upsertBuiltIn,
			{
				enabled: true,
				key: "er",
				promptHarness: "ER_Anamnese_chat",
				templateId,
			},
			{ context: adminContext },
		);

		const customAdminList = await call(adminScribeFormsHandler.list, undefined, {
			context: adminContext,
		});
		const builtInAdminList = await call(adminScribeFormsHandler.listBuiltIn, undefined, {
			context: adminContext,
		});
		const publicAvailable = await call(scribeFormsHandler.listAvailable, undefined, {
			context: publicContext,
		});
		const builtInSlug = getBuiltInAiscribeOverrideSlug("er");
		const publicBuiltIn = await call(
			scribeFormsHandler.getBySlug,
			{ slug: builtInSlug },
			{ context: publicContext },
		);

		expect(customAdminList).toEqual([]);
		expect(publicAvailable).toEqual([]);
		expect(publicBuiltIn?.slug).toBe(builtInSlug);
		expect(builtInAdminList.find((entry) => entry.key === "er")?.override?.template?.id).toBe(
			templateId,
		);
	});

	test("custom form create rejects reserved built-in slugs", async () => {
		await expect(
			call(
				adminScribeFormsHandler.create,
				{
					description: null,
					enabled: true,
					name: "Built In ER",
					promptHarness: "ER_Anamnese_chat",
					slug: getBuiltInAiscribeOverrideSlug("er"),
					templateId: null,
				},
				{ context: adminContext },
			),
		).rejects.toThrow("reservierten Pfad");
	});

	test("user can manage public AI forms that are visible to everyone", async () => {
		const created = await call(
			scribeFormsHandler.create,
			{
				description: "Persönlicher Echo-Text.",
				enabled: true,
				name: "Mein Echo Brief",
				promptHarness: "Inpatient_discharge",
				slug: "mein-echo-brief",
				templateId,
			},
			{ context: ownerContext },
		);

		const ownerList = await call(scribeFormsHandler.list, undefined, {
			context: ownerContext,
		});
		const adminList = await call(adminScribeFormsHandler.list, undefined, {
			context: adminContext,
		});
		const anonymousForm = await call(
			scribeFormsHandler.getBySlug,
			{ slug: "mein-echo-brief" },
			{ context: publicContext },
		);
		const ownerForm = await call(
			scribeFormsHandler.getBySlug,
			{ slug: "mein-echo-brief" },
			{ context: ownerContext },
		);
		const otherUserForm = await call(
			scribeFormsHandler.getBySlug,
			{ slug: "mein-echo-brief" },
			{ context: otherUserContext },
		);

		expect(created.authorId).toBe(ownerUserId);
		expect(created.visibility).toBe("public");
		expect(ownerList).toHaveLength(1);
		expect(ownerList[0]?.template?.id).toBe(templateId);
		expect(adminList).toEqual([]);
		expect(anonymousForm?.name).toBe("Mein Echo Brief");
		expect(anonymousForm?.author?.name).toBe("Dr. Clara Autorin");
		expect(ownerForm?.name).toBe("Mein Echo Brief");
		expect(otherUserForm?.name).toBe("Mein Echo Brief");
	});

	test("private user AI forms require Plus and are visible only to the owner", async () => {
		await expect(
			call(
				scribeFormsHandler.create,
				{
					description: null,
					enabled: true,
					name: "Privater Echo Brief",
					promptHarness: "Inpatient_discharge",
					slug: "privater-echo-brief",
					templateId,
					visibility: "private",
				},
				{ context: ownerContext },
			),
		).rejects.toThrow("Private AI Textbausteine");

		await createTestSubscription(server.db, ownerUserId);

		const created = await call(
			scribeFormsHandler.create,
			{
				description: "Privater Echo-Text.",
				enabled: true,
				name: "Privater Echo Brief",
				promptHarness: "Inpatient_discharge",
				slug: "privater-echo-brief",
				templateId,
				visibility: "private",
			},
			{ context: ownerContext },
		);

		const publicAvailable = await call(scribeFormsHandler.listAvailable, undefined, {
			context: publicContext,
		});
		const ownerAvailable = await call(scribeFormsHandler.listAvailable, undefined, {
			context: ownerContext,
		});
		const anonymousForm = await call(
			scribeFormsHandler.getBySlug,
			{ slug: "privater-echo-brief" },
			{ context: publicContext },
		);
		const ownerForm = await call(
			scribeFormsHandler.getBySlug,
			{ slug: "privater-echo-brief" },
			{ context: ownerContext },
		);
		const otherUserForm = await call(
			scribeFormsHandler.getBySlug,
			{ slug: "privater-echo-brief" },
			{ context: otherUserContext },
		);

		expect(created.authorId).toBe(ownerUserId);
		expect(created.visibility).toBe("private");
		expect(publicAvailable).toEqual([]);
		expect(ownerAvailable.map((form) => form.slug)).toContain("privater-echo-brief");
		expect(anonymousForm).toBeNull();
		expect(ownerForm?.name).toBe("Privater Echo Brief");
		expect(otherUserForm).toBeNull();
	});

	test("user form editor context only exposes visible templates", async () => {
		const otherPrivateTemplate = await createTestTemplate(server.db, otherUserId, {
			title: "Andere private Vorlage",
			visibility: "private",
		});

		const editorContext = await call(scribeFormsHandler.editorContext, undefined, {
			context: ownerContext,
		});
		const templateIds = editorContext.templates.map((item) => item.id);

		expect(editorContext.promptNames).toContain("discharge");
		expect(editorContext.promptHarnesses).toContainEqual({
			id: "discharge",
			label: "Entlassbrief",
		});
		expect(templateIds).toContain(templateId);
		expect(templateIds).toContain(privateTemplateId);
		expect(templateIds).not.toContain(otherPrivateTemplate.id);
	});

	test("user cannot update another user's personal AI form", async () => {
		const created = await call(
			scribeFormsHandler.create,
			{
				description: null,
				enabled: true,
				name: "Mein Echo Brief",
				promptHarness: "Diagnoses",
				slug: "mein-echo-brief",
				templateId: null,
			},
			{ context: ownerContext },
		);

		await expect(
			call(
				scribeFormsHandler.update,
				{
					description: null,
					enabled: true,
					id: created.id,
					name: "Übernommen",
					promptHarness: "Diagnoses",
					slug: "mein-echo-brief",
					templateId: null,
				},
				{ context: otherUserContext },
			),
		).rejects.toThrow("AI Text wurde nicht gefunden");

		const ownerForm = await call(
			scribeFormsHandler.getBySlug,
			{ slug: "mein-echo-brief" },
			{ context: ownerContext },
		);

		expect(ownerForm?.name).toBe("Mein Echo Brief");
	});
});
