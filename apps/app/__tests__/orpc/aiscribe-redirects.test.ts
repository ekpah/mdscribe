import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { call } from "@orpc/server";
import {
	aiDefaults,
	aiScribeFormConfig,
	aiScribeWorkspace,
	templateCollection,
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

	test("resolves a private entry's old URL only for its author", async () => {
		const { user: author } = await createTestUser(server.db, { username: "dr-a" });
		const { user: owner } = await createTestUser(server.db, {
			email: "owner@test.com",
			username: "dr-b",
		});
		const own = await createTestTemplate(server.db, owner.id, { visibility: "private" });
		await server.db.insert(aiScribeFormConfig).values({
			authorId: owner.id,
			id: own.id,
			inputPreset: "transcript",
			name: "Eigen",
			promptHarness: "anamnese",
			slug: "eigen",
			visibility: "private",
		});

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
		expect(await resolveAs(createMockSession(owner))).toBe(own.id);

		// After the template is deleted, the old URL no longer resolves.
		const context = createTestContext({ db: server.db, session: createMockSession(owner) });
		await call(templatesHandler.delete, { id: own.id }, { context });
		expect(await resolveAs(createMockSession(owner))).toBeNull();
	});
});
