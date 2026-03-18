import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { call } from "@orpc/server";

import { scribeFormsHandler as adminScribeFormsHandler } from "@/orpc/admin/scribe-forms";
import { scribeFormsHandler } from "@/orpc/scribe-forms";
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
});
