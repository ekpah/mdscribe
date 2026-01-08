import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { call } from "@orpc/server";
import { snippetsHandler } from "@/orpc/user/snippets";
import { activityHandler } from "@/orpc/user/activity";
import {
	createMockSession,
	createTestContext,
	createTestSnippet,
	createTestUsageEvent,
	createTestUser,
	startTestServer,
	type TestServer,
} from "../setup";

/**
 * Integration tests for user oRPC handlers
 *
 * Tests:
 * - Text snippets CRUD operations
 * - User activity/recent events
 */

describe("User oRPC Handlers", () => {
	let server: TestServer;

	beforeEach(async () => {
		server = await startTestServer("user-test");
	});

	afterEach(async () => {
		await server.close();
	});

	describe("Snippets Handlers", () => {
		describe("snippets.list", () => {
			test("returns empty array when user has no snippets", async () => {
				const { user } = await createTestUser(server.db);
				const session = createMockSession(user);
				const context = createTestContext({ db: server.db, session });

				const result = await call(snippetsHandler.list, undefined, { context });

				expect(result).toEqual([]);
			});

			test("returns user's snippets ordered by key", async () => {
				const { user } = await createTestUser(server.db);

				await createTestSnippet(server.db, user.id, {
					key: "zvk",
					snippet: "ZVK Anlage",
				});
				await createTestSnippet(server.db, user.id, {
					key: "art",
					snippet: "Arterielle Punktion",
				});
				await createTestSnippet(server.db, user.id, {
					key: "dia",
					snippet: "Diagnostik",
				});

				const session = createMockSession(user);
				const context = createTestContext({ db: server.db, session });

				const result = await call(snippetsHandler.list, undefined, { context });

				expect(result).toHaveLength(3);
				// Should be ordered alphabetically by key
				expect(result[0]!.key).toBe("art");
				expect(result[1]!.key).toBe("dia");
				expect(result[2]!.key).toBe("zvk");
			});

			test("only returns snippets for the authenticated user", async () => {
				const { user: user1 } = await createTestUser(server.db, {
					email: "user1@test.com",
				});
				const { user: user2 } = await createTestUser(server.db, {
					email: "user2@test.com",
				});

				await createTestSnippet(server.db, user1.id, { key: "user1-key" });
				await createTestSnippet(server.db, user2.id, { key: "user2-key" });

				const session = createMockSession(user1);
				const context = createTestContext({ db: server.db, session });

				const result = await call(snippetsHandler.list, undefined, { context });

				expect(result).toHaveLength(1);
				expect(result[0]!.key).toBe("user1-key");
			});
		});

		describe("snippets.get", () => {
			test("returns snippet by ID", async () => {
				const { user } = await createTestUser(server.db);
				const snippet = await createTestSnippet(server.db, user.id, {
					key: "test",
					snippet: "Test content",
				});

				const session = createMockSession(user);
				const context = createTestContext({ db: server.db, session });

				const result = await call(snippetsHandler.get, { id: snippet.id }, { context });

				expect(result).not.toBeNull();
				expect(result?.id).toBe(snippet.id);
				expect(result?.key).toBe("test");
				expect(result?.snippet).toBe("Test content");
			});

			test("returns null for non-existent snippet", async () => {
				const { user } = await createTestUser(server.db);
				const session = createMockSession(user);
				const context = createTestContext({ db: server.db, session });

				const result = await call(snippetsHandler.get, { id: "non-existent-id" }, { context });

				expect(result).toBeNull();
			});

			test("returns null for snippet owned by different user", async () => {
				const { user: owner } = await createTestUser(server.db, {
					email: "owner@test.com",
				});
				const { user: other } = await createTestUser(server.db, {
					email: "other@test.com",
				});

				const snippet = await createTestSnippet(server.db, owner.id);

				const session = createMockSession(other);
				const context = createTestContext({ db: server.db, session });

				const result = await call(snippetsHandler.get, { id: snippet.id }, { context });

				expect(result).toBeNull();
			});
		});

		describe("snippets.create", () => {
			test("creates a new snippet", async () => {
				const { user } = await createTestUser(server.db);
				const session = createMockSession(user);
				const context = createTestContext({ db: server.db, session });

				const result = await call(
					snippetsHandler.create,
					{ key: "newkey", snippet: "New snippet content" },
					{ context },
				);

				expect(result).toBeDefined();
				expect(result?.key).toBe("newkey");
				expect(result?.snippet).toBe("New snippet content");
				expect(result?.userId).toBe(user.id);
			});

			test("validates key length", async () => {
				const { user } = await createTestUser(server.db);
				const session = createMockSession(user);
				const context = createTestContext({ db: server.db, session });

				// Empty key should fail validation
				await expect(
					call(snippetsHandler.create, { key: "", snippet: "content" }, { context }),
				).rejects.toThrow();
			});
		});

		describe("snippets.update", () => {
			test("updates existing snippet", async () => {
				const { user } = await createTestUser(server.db);
				const snippet = await createTestSnippet(server.db, user.id, {
					key: "original",
					snippet: "Original content",
				});

				const session = createMockSession(user);
				const context = createTestContext({ db: server.db, session });

				const result = await call(
					snippetsHandler.update,
					{ id: snippet.id, key: "updated", snippet: "Updated content" },
					{ context },
				);

				expect(result?.key).toBe("updated");
				expect(result?.snippet).toBe("Updated content");
			});

			test("throws error when updating non-existent snippet", async () => {
				const { user } = await createTestUser(server.db);
				const session = createMockSession(user);
				const context = createTestContext({ db: server.db, session });

				await expect(
					call(
						snippetsHandler.update,
						{ id: "non-existent-id", key: "key", snippet: "content" },
						{ context },
					),
				).rejects.toThrow("Snippet not found");
			});

			test("throws error when updating snippet owned by different user", async () => {
				const { user: owner } = await createTestUser(server.db, {
					email: "owner@test.com",
				});
				const { user: attacker } = await createTestUser(server.db, {
					email: "attacker@test.com",
				});

				const snippet = await createTestSnippet(server.db, owner.id);

				const session = createMockSession(attacker);
				const context = createTestContext({ db: server.db, session });

				await expect(
					call(
						snippetsHandler.update,
						{ id: snippet.id, key: "hacked", snippet: "hacked content" },
						{ context },
					),
				).rejects.toThrow("Snippet not found");
			});
		});

		describe("snippets.delete", () => {
			test("deletes existing snippet", async () => {
				const { user } = await createTestUser(server.db);
				const snippet = await createTestSnippet(server.db, user.id);

				const session = createMockSession(user);
				const context = createTestContext({ db: server.db, session });

				const result = await call(snippetsHandler.delete, { id: snippet.id }, { context });

				expect(result).toEqual({ success: true });

				// Verify it's deleted
				const check = await call(snippetsHandler.get, { id: snippet.id }, { context });

				expect(check).toBeNull();
			});

			test("throws error when deleting non-existent snippet", async () => {
				const { user } = await createTestUser(server.db);
				const session = createMockSession(user);
				const context = createTestContext({ db: server.db, session });

				await expect(
					call(snippetsHandler.delete, { id: "non-existent-id" }, { context }),
				).rejects.toThrow("Snippet not found");
			});

			test("throws error when deleting snippet owned by different user", async () => {
				const { user: owner } = await createTestUser(server.db, {
					email: "owner@test.com",
				});
				const { user: attacker } = await createTestUser(server.db, {
					email: "attacker@test.com",
				});

				const snippet = await createTestSnippet(server.db, owner.id);

				const session = createMockSession(attacker);
				const context = createTestContext({ db: server.db, session });

				await expect(
					call(snippetsHandler.delete, { id: snippet.id }, { context }),
				).rejects.toThrow("Snippet not found");
			});
		});
	});

	describe("Activity Handlers", () => {
		describe("user.recentActivity", () => {
			test("returns empty array when user has no activity", async () => {
				const { user } = await createTestUser(server.db);
				const session = createMockSession(user);
				const context = createTestContext({ db: server.db, session });

				const result = await call(activityHandler.recentActivity, undefined, { context });

				expect(result).toEqual([]);
			});

			test("returns recent usage events for user", async () => {
				const { user } = await createTestUser(server.db);

				await createTestUsageEvent(server.db, user.id, {
					name: "ai_scribe_generation",
				});
				await createTestUsageEvent(server.db, user.id, {
					name: "template_search",
				});

				const session = createMockSession(user);
				const context = createTestContext({ db: server.db, session });

				const result = await call(activityHandler.recentActivity, undefined, { context });

				expect(result).toHaveLength(2);
			});

			test("limits results to 5 events", async () => {
				const { user } = await createTestUser(server.db);

				// Create 10 events
				for (let i = 0; i < 10; i++) {
					await createTestUsageEvent(server.db, user.id);
				}

				const session = createMockSession(user);
				const context = createTestContext({ db: server.db, session });

				const result = await call(activityHandler.recentActivity, undefined, { context });

				expect(result).toHaveLength(5);
			});

			test("only returns events for authenticated user", async () => {
				const { user: user1 } = await createTestUser(server.db, {
					email: "user1@test.com",
				});
				const { user: user2 } = await createTestUser(server.db, {
					email: "user2@test.com",
				});

				await createTestUsageEvent(server.db, user1.id, {
					name: "user1_event",
				});
				await createTestUsageEvent(server.db, user2.id, {
					name: "user2_event",
				});

				const session = createMockSession(user1);
				const context = createTestContext({ db: server.db, session });

				const result = await call(activityHandler.recentActivity, undefined, { context });

				expect(result).toHaveLength(1);
				expect(result[0]!.name).toBe("user1_event");
			});
		});
	});
});
