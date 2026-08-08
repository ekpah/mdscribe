import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { call } from "@orpc/server";
import { and, eq, template } from "@repo/database";

import type { TestServer } from "@/__tests__/setup";
import {
	createMockSession,
	createTestContext,
	createTestSubscription,
	createTestTemplate,
	createTestUser,
	startTestServer,
} from "@/__tests__/setup";
import { USER_MESSAGES } from "@/lib/user-messages";
import { templatesHandler } from "@/orpc/templates";

/**
 * Integration tests for templates oRPC handlers
 *
 * Tests both public (templates.get) and authenticated endpoints
 */

describe("Templates oRPC Handlers", () => {
	let server: TestServer;

	beforeEach(async () => {
		server = await startTestServer("templates-test");
	});

	afterEach(async () => {
		await server?.close();
	});

	describe("Public Endpoints", () => {
		describe("templates.get", () => {
			test("returns null for non-existent template", async () => {
				const context = createTestContext({ db: server.db });

				const result = await call(templatesHandler.get, { id: "non-existent-id" }, { context });

				expect(result).toBeNull();
			});

			test("returns template with author and favourite count", async () => {
				// Create a user and template
				const { user } = await createTestUser(server.db);
				const testTemplate = await createTestTemplate(server.db, user.id, {
					category: "Prozeduren",
					content: "ZVK Anlage Vorlage...",
					title: "ZVK Anlage",
				});

				const context = createTestContext({ db: server.db });

				const result = await call(templatesHandler.get, { id: testTemplate.id }, { context });

				expect(result).not.toBeNull();
				expect(result?.id).toBe(testTemplate.id);
				expect(result?.title).toBe("ZVK Anlage");
				expect(result?.category).toBe("Prozeduren");
				expect(result?.content).toBe("ZVK Anlage Vorlage...");
				expect(result?.author).toBeDefined();
				expect(result?.author?.id).toBe(user.id);
				expect("stripeCustomerId" in ((result?.author ?? {}) as Record<string, unknown>)).toBe(
					false,
				);
				expect(result?._count?.favouriteOf).toBe(0);
				expect(result?.favouriteOf).toEqual([]);
				expect(result?.examples).toEqual([]);
			});

			test("returns correct favourite count when template is favourited", async () => {
				const { user: author } = await createTestUser(server.db, {
					email: "author@test.com",
				});
				const { user: fan1 } = await createTestUser(server.db, {
					email: "fan1@test.com",
				});
				const { user: fan2 } = await createTestUser(server.db, {
					email: "fan2@test.com",
				});

				const testTemplate = await createTestTemplate(server.db, author.id);

				// Add favourites
				const { favourites } = await import("@repo/database");
				await server.db.insert(favourites).values([
					{ templateId: testTemplate.id, userId: fan1.id },
					{ templateId: testTemplate.id, userId: fan2.id },
				]);

				const context = createTestContext({ db: server.db });

				const result = await call(templatesHandler.get, { id: testTemplate.id }, { context });

				expect(result?._count?.favouriteOf).toBe(2);
				expect(result?.favouriteOf).toEqual([]);

				const fanContext = createTestContext({
					db: server.db,
					session: createMockSession(fan1),
				});
				const fanResult = await call(
					templatesHandler.get,
					{ id: testTemplate.id },
					{ context: fanContext },
				);
				expect(fanResult?._count?.favouriteOf).toBe(2);
				expect(fanResult?.favouriteOf).toEqual([{ id: fan1.id }]);
			});

			test("returns template examples", async () => {
				const { user } = await createTestUser(server.db);
				const createdTemplate = await createTestTemplate(server.db, user.id, {
					examples: ["First example", "Second example"],
				});

				const context = createTestContext({ db: server.db });

				const result = await call(templatesHandler.get, { id: createdTemplate.id }, { context });

				expect(result?.examples).toHaveLength(2);
				expect(result?.examples).toEqual(["First example", "Second example"]);
			});

			test("returns template information", async () => {
				const { user } = await createTestUser(server.db);
				const createdTemplate = await createTestTemplate(server.db, user.id, {
					information: "Nutze kurze Absätze.",
				});

				const context = createTestContext({ db: server.db });
				const result = await call(templatesHandler.get, { id: createdTemplate.id }, { context });

				expect(result?.information).toBe("Nutze kurze Absätze.");
			});

			test("hides private templates from anonymous and other users", async () => {
				const { user: author } = await createTestUser(server.db, {
					email: "author-private@test.com",
				});
				const { user: other } = await createTestUser(server.db, {
					email: "other-private@test.com",
				});
				const privateTemplate = await createTestTemplate(server.db, author.id, {
					title: "Private Template",
					visibility: "private",
				});
				const publicTemplate = await createTestTemplate(server.db, author.id, {
					title: "Public Template",
				});

				const anonymousContext = createTestContext({ db: server.db });
				const otherContext = createTestContext({
					db: server.db,
					session: createMockSession(other),
				});
				const authorContext = createTestContext({
					db: server.db,
					session: createMockSession(author),
				});

				expect(
					await call(
						templatesHandler.get,
						{ id: privateTemplate.id },
						{ context: anonymousContext },
					),
				).toBeNull();
				expect(
					await call(templatesHandler.get, { id: privateTemplate.id }, { context: otherContext }),
				).toBeNull();
				expect(
					await call(templatesHandler.get, { id: privateTemplate.id }, { context: authorContext }),
				).not.toBeNull();

				const anonymousList = await call(templatesHandler.list, undefined, {
					context: anonymousContext,
				});
				expect(anonymousList.map((item) => item.id)).toEqual([publicTemplate.id]);
			});
		});

		describe("templates.search", () => {
			test("fuzzy-matches titles and categories and applies template visibility", async () => {
				const { user: author } = await createTestUser(server.db);
				const titleMatch = await createTestTemplate(server.db, author.id, {
					content: "Allgemeiner Bericht",
					title: "Hypertonie",
				});
				const categoryMatch = await createTestTemplate(server.db, author.id, {
					category: "Hypertonie",
					content: "Allgemeiner Bericht",
					title: "Behandlungsbericht",
				});
				const contentOnlyMatch = await createTestTemplate(server.db, author.id, {
					content: "Behandlung einer Hypertonie",
					title: "Behandlungsbericht",
				});
				const privateMatch = await createTestTemplate(server.db, author.id, {
					content: "Allgemeiner Bericht",
					title: "Private Hypertonie-Vorlage",
					visibility: "private",
				});

				const anonymousResult = await call(
					templatesHandler.search,
					{ query: "  Hypertonnie  " },
					{
						context: createTestContext({ db: server.db }),
					},
				);
				const authorResult = await call(
					templatesHandler.search,
					{ query: "Hypertonnie" },
					{
						context: createTestContext({ db: server.db, session: createMockSession(author) }),
					},
				);

				expect(anonymousResult.map((item) => item.id)).toEqual(
					expect.arrayContaining([titleMatch.id, categoryMatch.id]),
				);
				expect(anonymousResult.map((item) => item.id)).not.toContain(contentOnlyMatch.id);
				expect(authorResult.map((item) => item.id)).toContain(privateMatch.id);
			});

			test("rejects an empty query", async () => {
				await expect(
					call(
						templatesHandler.search,
						{ query: "   " },
						{
							context: createTestContext({ db: server.db }),
						},
					),
				).rejects.toThrow();
			});
		});
	});

	describe("Authenticated Endpoints", () => {
		describe("templates.favourites", () => {
			test("returns empty array when user has no favourites", async () => {
				const { user } = await createTestUser(server.db);
				const session = createMockSession(user);
				const context = createTestContext({ db: server.db, session });

				const result = await call(templatesHandler.favourites, undefined, {
					context,
				});

				expect(result).toEqual([]);
			});

			test("returns user's favourite templates", async () => {
				const { user: author } = await createTestUser(server.db, {
					email: "author@test.com",
				});
				const { user } = await createTestUser(server.db, {
					email: "user@test.com",
				});

				const template1 = await createTestTemplate(server.db, author.id, {
					title: "Template 1",
				});
				const template2 = await createTestTemplate(server.db, author.id, {
					title: "Template 2",
				});

				// Add favourites
				const { favourites } = await import("@repo/database");
				await server.db.insert(favourites).values([
					{ templateId: template1.id, userId: user.id },
					{ templateId: template2.id, userId: user.id },
				]);

				const session = createMockSession(user);
				const context = createTestContext({ db: server.db, session });

				const result = await call(templatesHandler.favourites, undefined, {
					context,
				});

				expect(result).toHaveLength(2);
				expect(result.map((t) => t.title)).toContain("Template 1");
				expect(result.map((t) => t.title)).toContain("Template 2");
			});
		});

		describe("templates.authored", () => {
			test("returns empty array when user has no authored templates", async () => {
				const { user } = await createTestUser(server.db);
				const session = createMockSession(user);
				const context = createTestContext({ db: server.db, session });

				const result = await call(templatesHandler.authored, undefined, {
					context,
				});

				expect(result).toEqual([]);
			});

			test("returns user's authored templates (limited to 3)", async () => {
				const { user } = await createTestUser(server.db);

				// Create 4 templates
				for (let i = 1; i <= 4; i += 1) {
					await createTestTemplate(server.db, user.id, {
						title: `Template ${i}`,
					});
				}

				const session = createMockSession(user);
				const context = createTestContext({ db: server.db, session });

				const result = await call(templatesHandler.authored, undefined, {
					context,
				});

				// Should only return 3 (the limit)
				expect(result).toHaveLength(3);
			});
		});

		describe("templates.create", () => {
			test("creates a new template with examples", async () => {
				const { user } = await createTestUser(server.db);
				const session = createMockSession(user);
				const context = createTestContext({ db: server.db, session });

				const result = await call(
					templatesHandler.create,
					{
						category: "Test Category",
						content: "Template content here",
						examples: ["Example output one", "Example output two"],
						information: "Use concise sections.",
						name: "New Template",
					},
					{ context },
				);

				expect(result).toBeDefined();
				expect(result.title).toBe("New Template");
				expect(result.category).toBe("Test Category");
				expect(result.content).toBe("Template content here");
				expect(result.authorId).toBe(user.id);
				expect(result.visibility).toBe("public");

				const [savedTemplate] = await server.db
					.select({ examples: template.examples, information: template.information })
					.from(template)
					.where(eq(template.id, result.id));
				expect(savedTemplate?.examples).toEqual(["Example output one", "Example output two"]);
				expect(savedTemplate?.information).toBe("Use concise sections.");
			});

			test("requires plus to create private templates", async () => {
				const { user } = await createTestUser(server.db);
				const context = createTestContext({
					db: server.db,
					session: createMockSession(user),
				});

				await expect(
					call(
						templatesHandler.create,
						{
							category: "Test Category",
							content: "Private content",
							examples: [],
							name: "Private Template",
							visibility: "private",
						},
						{ context },
					),
				).rejects.toThrow();
			});

			test("rejects templates with conflicting Markdoc tag settings", async () => {
				const { user } = await createTestUser(server.db);
				const context = createTestContext({
					db: server.db,
					session: createMockSession(user),
				});

				await expect(
					call(
						templatesHandler.create,
						{
							category: "Test Category",
							content: `
{% info "Gewicht" type="number" /%}
{% info "Gewicht" type="date" /%}
`,
							examples: [],
							name: "Invalid Template",
						},
						{ context },
					),
				).rejects.toThrow(USER_MESSAGES.invalidTemplateTags);

				const savedTemplates = await server.db
					.select({ id: template.id })
					.from(template)
					.where(eq(template.authorId, user.id));
				expect(savedTemplates).toEqual([]);
			});

			test("allows plus users to create private templates", async () => {
				const { user } = await createTestUser(server.db);
				await createTestSubscription(server.db, user.id);
				const context = createTestContext({
					db: server.db,
					session: createMockSession(user),
				});

				const result = await call(
					templatesHandler.create,
					{
						category: "Test Category",
						content: "Private content",
						examples: [],
						name: "Private Template",
						visibility: "private",
					},
					{ context },
				);

				expect(result.visibility).toBe("private");
			});
		});

		describe("templates.update", () => {
			test("updates template owned by user", async () => {
				const { user } = await createTestUser(server.db);
				const createdTemplate = await createTestTemplate(server.db, user.id, {
					examples: ["Old example"],
					title: "Original Title",
				});

				const session = createMockSession(user);
				const context = createTestContext({ db: server.db, session });

				const result = await call(
					templatesHandler.update,
					{
						category: "Updated Category",
						content: "Updated content",
						examples: ["Updated example one", "Updated example two"],
						id: createdTemplate.id,
						information: "Lead with the assessment.",
						name: "Updated Title",
					},
					{ context },
				);

				expect(result.title).toBe("Updated Title");
				expect(result.category).toBe("Updated Category");
				expect(result.content).toBe("Updated content");

				const [savedTemplate] = await server.db
					.select({ examples: template.examples, information: template.information })
					.from(template)
					.where(eq(template.id, createdTemplate.id));
				expect(savedTemplate?.examples).toEqual(["Updated example one", "Updated example two"]);
				expect(savedTemplate?.information).toBe("Lead with the assessment.");
			});

			test("requires plus to keep templates private on update", async () => {
				const { user } = await createTestUser(server.db);
				const createdTemplate = await createTestTemplate(server.db, user.id, {
					visibility: "private",
				});
				const context = createTestContext({
					db: server.db,
					session: createMockSession(user),
				});

				await expect(
					call(
						templatesHandler.update,
						{
							category: "Updated Category",
							content: "Updated content",
							examples: [],
							id: createdTemplate.id,
							name: "Updated Title",
							visibility: "private",
						},
						{ context },
					),
				).rejects.toThrow();

				const publicResult = await call(
					templatesHandler.update,
					{
						category: "Updated Category",
						content: "Updated content",
						examples: [],
						id: createdTemplate.id,
						name: "Updated Title",
						visibility: "public",
					},
					{ context },
				);

				expect(publicResult.visibility).toBe("public");
			});

			test("does not update a template with conflicting Markdoc tag settings", async () => {
				const { user } = await createTestUser(server.db);
				const createdTemplate = await createTestTemplate(server.db, user.id, {
					content: "Original content",
				});
				const context = createTestContext({
					db: server.db,
					session: createMockSession(user),
				});

				await expect(
					call(
						templatesHandler.update,
						{
							category: "Updated Category",
							content: `
{% switch "Status" type="string" %}{% case "A" %}A{% /case %}{% /switch %}
{% switch "Status" type="boolean" %}{% case "true" %}Ja{% /case %}{% /switch %}
`,
							examples: [],
							id: createdTemplate.id,
							name: "Invalid Update",
						},
						{ context },
					),
				).rejects.toThrow(USER_MESSAGES.invalidTemplateTags);

				const [savedTemplate] = await server.db
					.select({ content: template.content })
					.from(template)
					.where(eq(template.id, createdTemplate.id));
				expect(savedTemplate?.content).toBe("Original content");
			});

			test("throws error when updating template not owned by user", async () => {
				const { user: owner } = await createTestUser(server.db, {
					email: "owner@test.com",
				});
				const { user: other } = await createTestUser(server.db, {
					email: "other@test.com",
				});

				const testTemplate = await createTestTemplate(server.db, owner.id);

				const session = createMockSession(other);
				const context = createTestContext({ db: server.db, session });

				await expect(
					call(
						templatesHandler.update,
						{
							category: "Hacked",
							content: "Hacked",
							examples: [],
							id: testTemplate.id,
							name: "Hacked",
						},
						{ context },
					),
				).rejects.toThrow();
			});
		});

		describe("templates.addFavourite", () => {
			test("adds template to user's favourites", async () => {
				const { user: author } = await createTestUser(server.db, {
					email: "author@test.com",
				});
				const { user } = await createTestUser(server.db);
				const testTemplate = await createTestTemplate(server.db, author.id);

				const session = createMockSession(user);
				const context = createTestContext({ db: server.db, session });

				const result = await call(
					templatesHandler.addFavourite,
					{ templateId: testTemplate.id },
					{ context },
				);

				expect(result).toEqual({ success: true });

				// Verify it was added
				const { favourites, eq: dbEq, and: dbAnd } = await import("@repo/database");
				const [fav] = await server.db
					.select()
					.from(favourites)
					.where(
						dbAnd(dbEq(favourites.templateId, testTemplate.id), dbEq(favourites.userId, user.id)),
					)
					.limit(1);

				expect(fav).toBeDefined();
			});

			test("handles duplicate favourite gracefully", async () => {
				const { user: author } = await createTestUser(server.db, {
					email: "author@test.com",
				});
				const { user } = await createTestUser(server.db);
				const testTemplate = await createTestTemplate(server.db, author.id);

				const session = createMockSession(user);
				const context = createTestContext({ db: server.db, session });

				// Add twice
				await call(templatesHandler.addFavourite, { templateId: testTemplate.id }, { context });

				const result = await call(
					templatesHandler.addFavourite,
					{ templateId: testTemplate.id },
					{ context },
				);

				expect(result).toEqual({ success: true });
			});
		});

		describe("templates.removeFavourite", () => {
			test("removes template from user's favourites", async () => {
				const { user: author } = await createTestUser(server.db, {
					email: "author@test.com",
				});
				const { user } = await createTestUser(server.db);
				const testTemplate = await createTestTemplate(server.db, author.id);

				// Add favourite first
				const { favourites } = await import("@repo/database");
				await server.db.insert(favourites).values({
					templateId: testTemplate.id,
					userId: user.id,
				});

				const session = createMockSession(user);
				const context = createTestContext({ db: server.db, session });

				const result = await call(
					templatesHandler.removeFavourite,
					{ templateId: testTemplate.id },
					{ context },
				);

				expect(result).toEqual({ success: true });

				// Verify it was removed
				const [fav] = await server.db
					.select()
					.from(favourites)
					.where(and(eq(favourites.templateId, testTemplate.id), eq(favourites.userId, user.id)))
					.limit(1);

				expect(fav).toBeUndefined();
			});
		});
	});
});
