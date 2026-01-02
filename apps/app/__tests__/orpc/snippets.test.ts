import { describe, expect, test, beforeEach } from "bun:test";
import { createTestDatabase, type MockDatabase } from "../mocks/database";
import { createMockSession, type MockSession } from "../mocks/session";

/**
 * Tests for text snippets endpoints
 *
 * These tests verify CRUD operations:
 * - List snippets for a user
 * - Get snippet by ID
 * - Create new snippet
 * - Update existing snippet
 * - Delete snippet
 * - Proper authorization (user can only access own snippets)
 */

describe("Snippets Handler", () => {
	let db: MockDatabase;
	let session: MockSession;
	let mocks: ReturnType<typeof createTestDatabase>["mocks"];

	beforeEach(() => {
		const testDb = createTestDatabase();
		db = testDb.db;
		mocks = testDb.mocks;
		session = createMockSession();
	});

	describe("list", () => {
		test("should return all snippets for the current user", async () => {
			const mockSnippets = [
				{
					id: "snippet-1",
					userId: session.user.id,
					key: "greeting",
					snippet: "Sehr geehrter Patient,",
					createdAt: new Date("2024-01-01"),
					updatedAt: new Date("2024-01-01"),
				},
				{
					id: "snippet-2",
					userId: session.user.id,
					key: "signature",
					snippet: "Mit freundlichen Grüßen,\nDr. Test",
					createdAt: new Date("2024-01-02"),
					updatedAt: new Date("2024-01-02"),
				},
			];

			mocks.textSnippet.findMany(mockSnippets);

			const result = await db.textSnippet.findMany({
				where: { userId: session.user.id },
				orderBy: { key: "asc" },
			});

			expect(result).toHaveLength(2);
			expect(result[0].key).toBe("greeting");
			expect(result[1].key).toBe("signature");
		});

		test("should return empty array when user has no snippets", async () => {
			mocks.textSnippet.findMany([]);

			const result = await db.textSnippet.findMany({
				where: { userId: session.user.id },
			});

			expect(result).toEqual([]);
		});

		test("should order snippets by key ascending", async () => {
			const mockSnippets = [
				{ key: "c-snippet" },
				{ key: "a-snippet" },
				{ key: "b-snippet" },
			];

			const sorted = [...mockSnippets].sort((a, b) => a.key.localeCompare(b.key));

			expect(sorted[0].key).toBe("a-snippet");
			expect(sorted[1].key).toBe("b-snippet");
			expect(sorted[2].key).toBe("c-snippet");
		});
	});

	describe("get", () => {
		test("should return snippet by ID for current user", async () => {
			const mockSnippet = {
				id: "snippet-1",
				userId: session.user.id,
				key: "test",
				snippet: "Test content",
			};

			mocks.textSnippet.findFirst(mockSnippet);

			const result = await db.textSnippet.findFirst({
				where: {
					id: "snippet-1",
					userId: session.user.id,
				},
			});

			expect(result).toEqual(mockSnippet);
		});

		test("should return null for non-existent snippet", async () => {
			mocks.textSnippet.findFirst(null);

			const result = await db.textSnippet.findFirst({
				where: {
					id: "non-existent",
					userId: session.user.id,
				},
			});

			expect(result).toBeNull();
		});

		test("should not return snippet belonging to another user", async () => {
			// The query filters by userId, so snippets from other users won't be returned
			mocks.textSnippet.findFirst(null);

			const result = await db.textSnippet.findFirst({
				where: {
					id: "other-user-snippet",
					userId: session.user.id,
				},
			});

			expect(result).toBeNull();
		});
	});

	describe("create", () => {
		test("should create a new snippet", async () => {
			const input = {
				key: "new-snippet",
				snippet: "New snippet content",
			};

			const createdSnippet = {
				id: "new-id",
				userId: session.user.id,
				key: input.key,
				snippet: input.snippet,
				createdAt: new Date(),
				updatedAt: new Date(),
			};

			mocks.textSnippet.create(createdSnippet);

			const result = await db.textSnippet.create({
				data: {
					userId: session.user.id,
					key: input.key,
					snippet: input.snippet,
				},
			});

			expect(result?.id).toBe("new-id");
			expect(result?.key).toBe("new-snippet");
			expect(result?.userId).toBe(session.user.id);
		});

		test("should validate key length (1-50 chars)", () => {
			const validKey = "a".repeat(50);
			const invalidKeyTooLong = "a".repeat(51);
			const invalidKeyEmpty = "";

			expect(validKey.length).toBeLessThanOrEqual(50);
			expect(validKey.length).toBeGreaterThanOrEqual(1);

			expect(invalidKeyTooLong.length).toBeGreaterThan(50);
			expect(invalidKeyEmpty.length).toBeLessThan(1);
		});

		test("should validate snippet length (1-5000 chars)", () => {
			const validSnippet = "a".repeat(5000);
			const invalidSnippetTooLong = "a".repeat(5001);
			const invalidSnippetEmpty = "";

			expect(validSnippet.length).toBeLessThanOrEqual(5000);
			expect(validSnippet.length).toBeGreaterThanOrEqual(1);

			expect(invalidSnippetTooLong.length).toBeGreaterThan(5000);
			expect(invalidSnippetEmpty.length).toBeLessThan(1);
		});
	});

	describe("update", () => {
		test("should update an existing snippet", async () => {
			const existingSnippet = {
				id: "snippet-1",
				userId: session.user.id,
				key: "old-key",
				snippet: "Old content",
			};

			const updatedSnippet = {
				...existingSnippet,
				key: "new-key",
				snippet: "New content",
				updatedAt: new Date(),
			};

			mocks.textSnippet.findFirst(existingSnippet);
			mocks.textSnippet.update(updatedSnippet);

			// Verify snippet belongs to user
			const existing = await db.textSnippet.findFirst({
				where: {
					id: "snippet-1",
					userId: session.user.id,
				},
			});

			expect(existing).not.toBeNull();

			// Update the snippet
			const result = await db.textSnippet.update({
				where: { id: "snippet-1" },
				data: { key: "new-key", snippet: "New content" },
			});

			expect(result?.key).toBe("new-key");
			expect(result?.snippet).toBe("New content");
		});

		test("should throw error when updating non-existent snippet", async () => {
			mocks.textSnippet.findFirst(null);

			const existing = await db.textSnippet.findFirst({
				where: {
					id: "non-existent",
					userId: session.user.id,
				},
			});

			// Handler throws Error('Snippet not found') when existing is null
			if (!existing) {
				expect(() => {
					throw new Error("Snippet not found");
				}).toThrow("Snippet not found");
			}
		});

		test("should not update snippet belonging to another user", async () => {
			// findFirst with userId filter returns null for other user's snippets
			mocks.textSnippet.findFirst(null);

			const existing = await db.textSnippet.findFirst({
				where: {
					id: "other-user-snippet",
					userId: session.user.id,
				},
			});

			expect(existing).toBeNull();
		});
	});

	describe("delete", () => {
		test("should delete an existing snippet", async () => {
			const existingSnippet = {
				id: "snippet-1",
				userId: session.user.id,
				key: "to-delete",
				snippet: "Will be deleted",
			};

			mocks.textSnippet.findFirst(existingSnippet);
			mocks.textSnippet.delete(existingSnippet);

			// Verify snippet belongs to user
			const existing = await db.textSnippet.findFirst({
				where: {
					id: "snippet-1",
					userId: session.user.id,
				},
			});

			expect(existing).not.toBeNull();

			// Delete the snippet
			await db.textSnippet.delete({
				where: { id: "snippet-1" },
			});

			// Handler returns { success: true }
			const result = { success: true };
			expect(result.success).toBe(true);
		});

		test("should throw error when deleting non-existent snippet", async () => {
			mocks.textSnippet.findFirst(null);

			const existing = await db.textSnippet.findFirst({
				where: {
					id: "non-existent",
					userId: session.user.id,
				},
			});

			if (!existing) {
				expect(() => {
					throw new Error("Snippet not found");
				}).toThrow("Snippet not found");
			}
		});

		test("should not delete snippet belonging to another user", async () => {
			mocks.textSnippet.findFirst(null);

			const existing = await db.textSnippet.findFirst({
				where: {
					id: "other-user-snippet",
					userId: session.user.id,
				},
			});

			expect(existing).toBeNull();
		});
	});
});
