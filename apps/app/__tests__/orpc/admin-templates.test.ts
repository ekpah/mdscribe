import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { call } from "@orpc/server";
import {
	aiDefaults,
	aiScribeFormConfig,
	aiScribeWorkspace,
	eq,
	template,
	templateCollectionTemplate,
} from "@repo/database";

import { ADMIN_EMAIL, createTestContext, createTestUser, startTestServer } from "@/__tests__/setup";
import type { TestServer } from "@/__tests__/setup";
import { validateAppTemplate } from "@/features/template-tags/config";
import { convertAiScribeForms } from "@/orpc/admin/convert-ai-scribe-forms";
import { templatesHandler } from "@/orpc/admin/templates";

describe("AI Scribe standard templates", () => {
	let server: TestServer;

	beforeEach(async () => {
		server = await startTestServer("admin-templates");
	});

	afterEach(async () => {
		await server?.close();
	});

	test("are created once as the AI Scribe collection the conversion reads", async () => {
		const { session, user } = await createTestUser(server.db, { email: ADMIN_EMAIL });
		const context = createTestContext({ db: server.db, session });

		const { collectionId, created } = await call(
			templatesHandler.createAiScribeStandard,
			undefined,
			{ context },
		);

		const [defaults] = await server.db.select().from(aiDefaults).where(eq(aiDefaults.id, "global"));
		expect(defaults?.aiScribeCollectionId).toBe(collectionId);
		const templates = await server.db
			.select({
				authorId: template.authorId,
				content: template.content,
				visibility: template.visibility,
			})
			.from(templateCollectionTemplate)
			.innerJoin(template, eq(templateCollectionTemplate.templateId, template.id))
			.where(eq(templateCollectionTemplate.collectionId, collectionId));
		expect(created).toBe(10);
		expect(templates).toHaveLength(10);
		for (const standard of templates) {
			expect(standard).toMatchObject({ authorId: user.id, visibility: "public" });
			expect(validateAppTemplate(standard.content).filter((d) => d.severity === "error")).toEqual(
				[],
			);
		}
		// Old entries that need every standard: a Baukasten's four slots and a form per harness.
		await server.db
			.insert(aiScribeWorkspace)
			.values({ authorId: null, name: "Brief", slug: "brief" });
		await server.db.insert(aiScribeFormConfig).values(
			["discharge", "icu-transfer", "outpatient", "procedures"].map((harness) => ({
				authorId: null,
				inputPreset: "transcript",
				name: harness,
				promptHarness: harness,
				slug: harness,
			})),
		);
		const conversion = await convertAiScribeForms(server.db, { dryRun: true, ownerId: user.id });
		expect(conversion.missingStandards).toEqual([]);

		await expect(
			call(templatesHandler.createAiScribeStandard, undefined, { context }),
		).rejects.toMatchObject({ code: "CONFLICT" });
		expect(await server.db.select({ id: template.id }).from(template)).toHaveLength(10);
		expect(conversion.entries).toHaveLength(5);
	});
});
