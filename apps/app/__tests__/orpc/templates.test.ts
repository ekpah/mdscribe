import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { call } from "@orpc/server";
import { and, eq, templateExample } from "@repo/database";
import { templatesHandler } from "@/orpc/templates";
import type { TestServer } from "@/__tests__/setup";
import {
	createMockSession,
	createTestContext,
	createTestTemplate,
	createTestUser,
	startTestServer,
} from "@/__tests__/setup";

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

				const result = await call(
					templatesHandler.get,
					{ id: "non-existent-id" },
					{ context },
				);

				expect(result).toBeNull();
			});

				test("returns template with author and favourite count", async () => {
					// Create a user and template
					const { user } = await createTestUser(server.db);
					const template = await createTestTemplate(server.db, user.id, {
						category: "Prozeduren",
						content: "ZVK Anlage Vorlage...",
						title: "ZVK Anlage",
					});

				const context = createTestContext({ db: server.db });

				const result = await call(
					templatesHandler.get,
					{ id: template.id },
					{ context },
				);

				expect(result).not.toBeNull();
				expect(result?.id).toBe(template.id);
				expect(result?.title).toBe("ZVK Anlage");
				expect(result?.category).toBe("Prozeduren");
				expect(result?.content).toBe("ZVK Anlage Vorlage...");
				expect(result?.author).toBeDefined();
				expect(result?.author?.id).toBe(user.id);
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

				const template = await createTestTemplate(server.db, author.id);

				// Add favourites
				const { favourites } = await import("@repo/database");
				await server.db.insert(favourites).values([
					{ templateId: template.id, userId: fan1.id },
					{ templateId: template.id, userId: fan2.id },
				]);

				const context = createTestContext({ db: server.db });

				const result = await call(
					templatesHandler.get,
					{ id: template.id },
					{ context },
				);

				expect(result?._count?.favouriteOf).toBe(2);
				expect(result?.favouriteOf).toHaveLength(2);
			});

			test("returns template examples", async () => {
				const { user } = await createTestUser(server.db);
				const createdTemplate = await createTestTemplate(server.db, user.id);

					await server.db.insert(templateExample).values([
						{
							content: "Second example",
							templateId: createdTemplate.id,
						},
						{
							content: "First example",
							templateId: createdTemplate.id,
						},
					]);

				const context = createTestContext({ db: server.db });

				const result = await call(
					templatesHandler.get,
					{ id: createdTemplate.id },
					{ context },
				);

				expect(result?.examples).toHaveLength(2);
				expect(result?.examples.map((example) => example.content)).toEqual(
					expect.arrayContaining(["First example", "Second example"]),
				);
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
			test("creates a new template with embedding and examples", async () => {
				const { user } = await createTestUser(server.db);
				const session = createMockSession(user);
				const context = createTestContext({ db: server.db, session });

					const result = await call(
						templatesHandler.create,
						{
							category: "Test Category",
							content: "Template content here",
							examples: ["Example output one", "Example output two"],
							name: "New Template",
						},
						{ context },
					);

				expect(result).toBeDefined();
				expect(result.title).toBe("New Template");
				expect(result.category).toBe("Test Category");
				expect(result.content).toBe("Template content here");
				expect(result.authorId).toBe(user.id);
				expect(result.embedding).toBeDefined();
				expect(result.embedding).toHaveLength(1024);

				const savedExamples = await server.db
					.select()
					.from(templateExample)
					.where(eq(templateExample.templateId, result.id));
				expect(savedExamples).toHaveLength(2);
				expect(savedExamples.map((example) => example.content)).toEqual(
					expect.arrayContaining(["Example output one", "Example output two"]),
				);
			});
		});

		describe("templates.update", () => {
			test("updates template owned by user", async () => {
				const { user } = await createTestUser(server.db);
					const template = await createTestTemplate(server.db, user.id, {
						title: "Original Title",
					});
					await server.db.insert(templateExample).values({
						content: "Old example",
						templateId: template.id,
					});

				const session = createMockSession(user);
				const context = createTestContext({ db: server.db, session });

					const result = await call(
						templatesHandler.update,
						{
							category: "Updated Category",
							content: "Updated content",
							examples: ["Updated example one", "Updated example two"],
							id: template.id,
							name: "Updated Title",
						},
						{ context },
					);

				expect(result.title).toBe("Updated Title");
				expect(result.category).toBe("Updated Category");
				expect(result.content).toBe("Updated content");

				const savedExamples = await server.db
					.select()
					.from(templateExample)
					.where(eq(templateExample.templateId, template.id));
				expect(savedExamples).toHaveLength(2);
				expect(savedExamples.map((example) => example.content)).toEqual(
					expect.arrayContaining(["Updated example one", "Updated example two"]),
				);
			});

			test("throws error when updating template not owned by user", async () => {
				const { user: owner } = await createTestUser(server.db, {
					email: "owner@test.com",
				});
				const { user: other } = await createTestUser(server.db, {
					email: "other@test.com",
				});

				const template = await createTestTemplate(server.db, owner.id);

				const session = createMockSession(other);
				const context = createTestContext({ db: server.db, session });

				await expect(
						call(
							templatesHandler.update,
							{
								category: "Hacked",
								content: "Hacked",
								examples: [],
								id: template.id,
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
				const template = await createTestTemplate(server.db, author.id);

				const session = createMockSession(user);
				const context = createTestContext({ db: server.db, session });

				const result = await call(
					templatesHandler.addFavourite,
					{ templateId: template.id },
					{ context },
				);

				expect(result).toEqual({ success: true });

				// Verify it was added
				const { favourites, eq: dbEq, and: dbAnd } = await import("@repo/database");
				const [fav] = await server.db
					.select()
					.from(favourites)
					.where(
						dbAnd(
							dbEq(favourites.templateId, template.id),
							dbEq(favourites.userId, user.id),
						),
					)
					.limit(1);

				expect(fav).toBeDefined();
			});

			test("handles duplicate favourite gracefully", async () => {
				const { user: author } = await createTestUser(server.db, {
					email: "author@test.com",
				});
				const { user } = await createTestUser(server.db);
				const template = await createTestTemplate(server.db, author.id);

				const session = createMockSession(user);
				const context = createTestContext({ db: server.db, session });

				// Add twice
				await call(
					templatesHandler.addFavourite,
					{ templateId: template.id },
					{ context },
				);

				const result = await call(
					templatesHandler.addFavourite,
					{ templateId: template.id },
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
				const template = await createTestTemplate(server.db, author.id);

				// Add favourite first
				const { favourites } = await import("@repo/database");
				await server.db.insert(favourites).values({
					templateId: template.id,
					userId: user.id,
				});

				const session = createMockSession(user);
				const context = createTestContext({ db: server.db, session });

				const result = await call(
					templatesHandler.removeFavourite,
					{ templateId: template.id },
					{ context },
				);

				expect(result).toEqual({ success: true });

				// Verify it was removed
				const [fav] = await server.db
					.select()
					.from(favourites)
					.where(
						and(
							eq(favourites.templateId, template.id),
							eq(favourites.userId, user.id),
						),
					)
					.limit(1);

				expect(fav).toBeUndefined();
			});
		});
	});
});
