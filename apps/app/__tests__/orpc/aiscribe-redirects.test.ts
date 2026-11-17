import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { call } from "@orpc/server";
import {
	aiDefaults,
	aiScribeFormConfig,
	aiScribeWorkspace,
	templateCollection,
	eq,
	template,
	templateCollectionTemplate,
} from "@repo/database";

import {
	createMockSession,
	createTestContext,
	createTestTemplate,
	createTestUser,
	startTestServer,
} from "@/__tests__/setup";
import type { TestServer } from "@/__tests__/setup";
import { convertAiScribeForms } from "@/orpc/admin/convert-ai-scribe-forms";
import { resolveAiscribeRedirectHandler } from "@/orpc/aiscribe-redirects";
import { templatesHandler } from "@/orpc/templates";

describe("Old AI Scribe URLs", () => {
	let server: TestServer;

	beforeEach(async () => {
		server = await startTestServer("aiscribe-redirects");
	});

	afterEach(async () => {
		await server?.close();
	});

	test("resolve to the template converted from the same form or workspace", async () => {
		const { user } = await createTestUser(server.db, { username: "dr-a" });
		const { user: other } = await createTestUser(server.db, {
			email: "other@test.com",
			username: "dr-b",
		});
		const globalForm = await createTestTemplate(server.db, user.id);
		const userForm = await createTestTemplate(server.db, user.id);
		const workspace = await createTestTemplate(server.db, user.id);
		const standard = await createTestTemplate(server.db, user.id, { title: "Anamnese" });
		const form = { inputPreset: "transcript", promptHarness: "anamnese" };
		await server.db.insert(aiScribeFormConfig).values([
			{ ...form, authorId: null, id: globalForm.id, name: "Global", slug: "brief" },
			// Same slug in two namespaces: the username decides.
			{ ...form, authorId: user.id, id: userForm.id, name: "Mine", slug: "brief" },
			{ ...form, authorId: other.id, name: "Not converted", slug: "brief" },
		]);
		await server.db
			.insert(aiScribeWorkspace)
			.values({ authorId: null, id: workspace.id, name: "Baukasten", slug: "kardio" });
		const [collection] = await server.db
			.insert(templateCollection)
			.values({ name: "AI Scribe", userId: user.id })
			.returning();
		await server.db
			.insert(templateCollectionTemplate)
			.values({ collectionId: collection?.id ?? "", templateId: standard.id });
		await server.db
			.insert(aiDefaults)
			.values({ aiScribeCollectionId: collection?.id, id: "global", updatedAt: new Date() });

		const context = createTestContext({ db: server.db, session: createMockSession(user) });
		const resolve = async (kind: "builtin" | "custom" | "workspace", path: string[]) => {
			const result = await call(resolveAiscribeRedirectHandler, { kind, path }, { context });
			return result.templateId;
		};

		expect(await resolve("custom", ["brief"])).toBe(globalForm.id);
		expect(await resolve("custom", ["u", "dr-a", "brief"])).toBe(userForm.id);
		expect(await resolve("custom", ["u", "dr-b", "brief"])).toBeNull();
		expect(await resolve("custom", ["u", "nobody", "brief"])).toBeNull();
		expect(await resolve("workspace", ["kardio"])).toBe(workspace.id);
		expect(await resolve("workspace", ["brief"])).toBeNull();
		expect(await resolve("builtin", ["er"])).toBe(standard.id);
		expect(await resolve("builtin", ["toString"])).toBeNull();
	});

	test("converts only once the AI Scribe collection holds the standard templates", async () => {
		const { user } = await createTestUser(server.db);
		const [form] = await server.db
			.insert(aiScribeFormConfig)
			.values({ inputPreset: "transcript", name: "Aufnahme", promptHarness: "anamnese", slug: "a" })
			.returning();
		const options = { dryRun: false, ownerId: user.id };

		// Without the collection the instruction-less built-in fallback would be used.
		expect(await convertAiScribeForms(server.db, { ...options, dryRun: true })).toEqual({
			entries: [{ id: form?.id, title: "Aufnahme", visibility: "public" }],
			missingStandards: ["Anamnese"],
		});
		await expect(convertAiScribeForms(server.db, options)).rejects.toThrow("Anamnese");
		expect(
			await server.db
				.select()
				.from(template)
				.where(eq(template.id, form?.id ?? "")),
		).toHaveLength(0);

		const standard = await createTestTemplate(server.db, user.id, {
			content: "Standard-Anamnese {% ai %}Aufnahmegrund{% /ai %}",
			title: "Anamnese",
		});
		const [collection] = await server.db
			.insert(templateCollection)
			.values({ name: "AI Scribe", userId: user.id })
			.returning();
		await server.db
			.insert(templateCollectionTemplate)
			.values({ collectionId: collection?.id ?? "", templateId: standard.id });
		await server.db
			.insert(aiDefaults)
			.values({ aiScribeCollectionId: collection?.id, id: "global", updatedAt: new Date() });

		const result = await convertAiScribeForms(server.db, options);
		expect(result.missingStandards).toEqual([]);
		const [converted] = await server.db
			.select({ content: template.content })
			.from(template)
			.where(eq(template.id, form?.id ?? ""));
		expect(converted?.content).toBe(standard.content);
	});

	test("copies only content the new author could see, and hides private results", async () => {
		const { user: admin } = await createTestUser(server.db, { username: "admin" });
		const { user: author } = await createTestUser(server.db, {
			email: "author@test.com",
			username: "dr-a",
		});
		const { user: owner } = await createTestUser(server.db, {
			email: "owner@test.com",
			username: "dr-b",
		});
		const standard = await createTestTemplate(server.db, admin.id, {
			content: "Standard-Anamnese",
			title: "Anamnese",
		});
		// Someone else's template, linked while it was public and made private since.
		const secret = await createTestTemplate(server.db, owner.id, {
			content: "Geheimer Inhalt",
			visibility: "private",
		});
		const [collection] = await server.db
			.insert(templateCollection)
			.values({ name: "AI Scribe", userId: admin.id })
			.returning();
		await server.db
			.insert(templateCollectionTemplate)
			.values({ collectionId: collection?.id ?? "", templateId: standard.id });
		await server.db
			.insert(aiDefaults)
			.values({ aiScribeCollectionId: collection?.id, id: "global", updatedAt: new Date() });
		const form = { inputPreset: "transcript", promptHarness: "anamnese" };
		const [linked, own] = await server.db
			.insert(aiScribeFormConfig)
			.values([
				{ ...form, authorId: author.id, name: "Verlinkt", slug: "verlinkt", templateId: secret.id },
				{ ...form, authorId: owner.id, name: "Eigen", slug: "eigen", visibility: "private" },
			])
			.returning();

		await convertAiScribeForms(server.db, { dryRun: false, ownerId: admin.id });
		const [converted] = await server.db
			.select({ content: template.content })
			.from(template)
			.where(eq(template.id, linked?.id ?? ""));
		expect(converted?.content).toBe("Standard-Anamnese");

		// The old URL of a private entry resolves only for its author.
		const resolveAs = async (session: ReturnType<typeof createMockSession>) => {
			const context = createTestContext({ db: server.db, session });
			const path = ["u", "dr-b", "eigen"];
			const result = await call(
				resolveAiscribeRedirectHandler,
				{ kind: "custom", path },
				{ context },
			);
			return result.templateId;
		};
		expect(await resolveAs(createMockSession(author))).toBeNull();
		expect(await resolveAs(createMockSession(owner))).toBe(own?.id);

		// A deleted conversion stays deleted when the conversion runs again.
		const context = createTestContext({ db: server.db, session: createMockSession(owner) });
		await call(templatesHandler.delete, { id: own?.id ?? "" }, { context });
		const rerun = await convertAiScribeForms(server.db, { dryRun: true, ownerId: admin.id });
		expect(rerun.entries).toEqual([]);
	});
});
