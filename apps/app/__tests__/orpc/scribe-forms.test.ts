import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { call } from "@orpc/server";

import { scribeFormsHandler as adminScribeFormsHandler } from "@/orpc/admin/scribe-forms";
import { scribeFormsHandler } from "@/orpc/scribe-forms";
import { getBuiltInAiscribeOverrideSlug } from "@/lib/aiscribe-built-ins";
import type { TestServer } from "@/__tests__/setup";
import {
	ADMIN_EMAIL,
	createMockSession,
	createTestAiDefaults,
	createTestContext,
	createTestTemplate,
	createTestUser,
	startTestServer,
} from "@/__tests__/setup";

describe("AI Scribe Forms Handlers", () => {
	let server: TestServer;
	let adminContext: ReturnType<typeof createTestContext>;
	let publicContext: ReturnType<typeof createTestContext>;
	let templateId: string;
	let modelId: string;

	beforeEach(async () => {
		server = await startTestServer("scribe-forms");
		const { user: adminUser } = await createTestUser(server.db, {
			email: ADMIN_EMAIL,
		});
		const { user: authorUser } = await createTestUser(server.db, {
			email: "doctor@test.com",
		});
		const session = createMockSession(adminUser);
		const seeded = await createTestAiDefaults(server.db);
		const template = await createTestTemplate(server.db, authorUser.id, {
			title: "Briefvorlage",
		});

		templateId = template.id;
		modelId = seeded.modelRecordId;
		adminContext = createTestContext({ db: server.db, session });
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
					modelId,
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
		expect(listed).toHaveLength(1);
		expect(listed[0]?.template?.id).toBe(templateId);
		expect(listed[0]?.model?.id).toBe(modelId);
		expect(publicForm?.name).toBe("Echo Brief");
	});

	test("disabled custom AI forms are hidden from public reads", async () => {
			const created = await call(
				adminScribeFormsHandler.create,
				{
					description: null,
					enabled: true,
					modelId: null,
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
					modelId: null,
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
				modelId,
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
		expect(
			builtInAdminList.find((entry) => entry.key === "er")?.override?.template?.id,
		).toBe(templateId);
		expect(
			builtInAdminList.find((entry) => entry.key === "er")?.override?.model?.id,
		).toBe(modelId);
	});

	test("custom form create rejects reserved built-in slugs", async () => {
		await expect(
			call(
				adminScribeFormsHandler.create,
				{
					description: null,
					enabled: true,
					modelId: null,
					name: "Built In ER",
					promptHarness: "ER_Anamnese_chat",
					slug: getBuiltInAiscribeOverrideSlug("er"),
					templateId: null,
				},
				{ context: adminContext },
			),
		).rejects.toThrow("reservierten Pfad");
	});
});
