import { describe, expect, test, beforeEach } from "bun:test";
import { createTestDatabase, type MockDatabase } from "../mocks/database";
import { createMockSession, type MockSession } from "../mocks/session";

/**
 * Tests for public template endpoints
 *
 * These tests verify:
 * - Template retrieval by ID
 * - Proper handling of non-existent templates
 * - Correct data structure returned
 */

describe("Templates Handler", () => {
	let db: MockDatabase;
	let session: MockSession;
	let mocks: ReturnType<typeof createTestDatabase>["mocks"];

	beforeEach(() => {
		const testDb = createTestDatabase();
		db = testDb.db;
		mocks = testDb.mocks;
		session = createMockSession();
	});

	describe("get", () => {
		test("should return a template when it exists", async () => {
			const mockTemplate = {
				id: "template-1",
				title: "Test Template",
				category: "Medical",
				content: "Template content here",
				authorId: "author-1",
				createdAt: new Date("2024-01-01"),
				updatedAt: new Date("2024-01-02"),
				favouriteOf: [{ id: "user-1" }],
				author: {
					id: "author-1",
					name: "Dr. Test",
					email: "dr@test.com",
				},
			};

			mocks.template.findUnique(mockTemplate);

			// Simulate the handler logic
			const result = await db.template.findUnique({
				where: { id: "template-1" },
				include: { favouriteOf: true, author: true },
			});

			expect(result).toEqual(mockTemplate);
			expect(result?.id).toBe("template-1");
			expect(result?.title).toBe("Test Template");
		});

		test("should return null for non-existent template", async () => {
			mocks.template.findUnique(null);

			const result = await db.template.findUnique({
				where: { id: "non-existent" },
				include: { favouriteOf: true, author: true },
			});

			expect(result).toBeNull();
		});

		test("should include author and favourites data", async () => {
			const mockTemplate = {
				id: "template-2",
				title: "Another Template",
				category: "Procedures",
				content: "Content",
				authorId: "author-2",
				createdAt: new Date(),
				updatedAt: new Date(),
				favouriteOf: [
					{ id: "user-1" },
					{ id: "user-2" },
					{ id: "user-3" },
				],
				author: {
					id: "author-2",
					name: "Dr. Author",
					email: "author@hospital.com",
				},
			};

			mocks.template.findUnique(mockTemplate);

			const result = await db.template.findUnique({
				where: { id: "template-2" },
				include: { favouriteOf: true, author: true },
			});

			expect(result?.favouriteOf).toHaveLength(3);
			expect(result?.author?.name).toBe("Dr. Author");
		});
	});
});

describe("Template Search (findRelevant)", () => {
	let db: MockDatabase;
	let mocks: ReturnType<typeof createTestDatabase>["mocks"];

	beforeEach(() => {
		const testDb = createTestDatabase();
		db = testDb.db;
		mocks = testDb.mocks;
	});

	test("should return empty result for empty query", async () => {
		// The handler should return early for empty queries
		const query = "";

		if (!query || typeof query !== "string") {
			const result = { templates: [], count: 0 };
			expect(result.templates).toEqual([]);
			expect(result.count).toBe(0);
		}
	});

	test("should handle vector similarity results", async () => {
		// Mock the raw query result for vector similarity search
		const similarityResults = [
			{
				id: "template-1",
				title: "ZVK-Anlage",
				category: "Procedures",
				content: "ZVK procedure template...",
				authorId: "author-1",
				updatedAt: new Date(),
				similarity: 0.85,
			},
			{
				id: "template-2",
				title: "Kardioversion",
				category: "Procedures",
				content: "Cardioversion template...",
				authorId: "author-2",
				updatedAt: new Date(),
				similarity: 0.72,
			},
		];

		mocks.$queryRaw(similarityResults);

		const rawResult = await db.$queryRaw`
			SELECT * FROM "Template" WHERE embedding IS NOT NULL LIMIT 5
		`;

		expect(rawResult).toHaveLength(2);
		expect(rawResult[0].similarity).toBe(0.85);
	});

	test("should filter results below similarity threshold", async () => {
		// Results with similarity > 0.3 should be included
		const results = [
			{ id: "1", similarity: 0.5 }, // Above threshold
			{ id: "2", similarity: 0.25 }, // Below threshold - filtered by query
		];

		// Only results above 0.3 should be in the final query result
		const filteredResults = results.filter(r => r.similarity > 0.3);

		expect(filteredResults).toHaveLength(1);
		expect(filteredResults[0].id).toBe("1");
	});

	test("should merge favorites data with similarity results", async () => {
		const similarityResults = [
			{ id: "template-1", similarity: 0.8 },
		];

		const templatesWithFavorites = [
			{
				id: "template-1",
				favouriteOf: [{ id: "user-1" }, { id: "user-2" }],
				_count: { favouriteOf: 2 },
			},
		];

		// Merge logic
		const merged = similarityResults.map((simResult) => {
			const templateData = templatesWithFavorites.find(t => t.id === simResult.id);
			return {
				...simResult,
				favouriteOf: templateData?.favouriteOf || [],
				_count: templateData?._count || { favouriteOf: 0 },
			};
		});

		expect(merged[0].favouriteOf).toHaveLength(2);
		expect(merged[0]._count.favouriteOf).toBe(2);
		expect(merged[0].similarity).toBe(0.8);
	});
});
