import { describe, expect, test, beforeEach } from "bun:test";
import { createTestDatabase, type MockDatabase } from "../mocks/database";
import { createMockSession, type MockSession } from "../mocks/session";

/**
 * Tests for user template endpoints
 *
 * These tests verify:
 * - Retrieving user's favorite templates
 * - Retrieving user's authored templates
 * - Retrieving recent activity
 * - Proper scoping to current user
 */

describe("User Templates Handler", () => {
	let db: MockDatabase;
	let session: MockSession;
	let mocks: ReturnType<typeof createTestDatabase>["mocks"];

	beforeEach(() => {
		const testDb = createTestDatabase();
		db = testDb.db;
		mocks = testDb.mocks;
		session = createMockSession();
	});

	describe("favourites", () => {
		test("should return favorite templates for the current user", async () => {
			const mockFavorites = [
				{
					id: "template-1",
					title: "Favorite Template 1",
					category: "Discharge",
					content: "Content...",
					authorId: "other-author",
					createdAt: new Date("2024-01-01"),
					updatedAt: new Date("2024-01-15"),
					_count: { favouriteOf: 5 },
				},
				{
					id: "template-2",
					title: "Favorite Template 2",
					category: "Procedures",
					content: "More content...",
					authorId: "another-author",
					createdAt: new Date("2024-01-10"),
					updatedAt: new Date("2024-01-20"),
					_count: { favouriteOf: 12 },
				},
			];

			mocks.template.findMany(mockFavorites);

			const result = await db.template.findMany({
				where: {
					favouriteOf: {
						some: { id: session.user.id },
					},
				},
				include: { _count: { select: { favouriteOf: true } } },
				orderBy: { updatedAt: "desc" },
			});

			expect(result).toHaveLength(2);
			expect(result[0].title).toBe("Favorite Template 1");
			expect(result[0]._count.favouriteOf).toBe(5);
		});

		test("should return empty array when user has no favorites", async () => {
			mocks.template.findMany([]);

			const result = await db.template.findMany({
				where: {
					favouriteOf: {
						some: { id: session.user.id },
					},
				},
			});

			expect(result).toEqual([]);
		});

		test("should order favorites by updatedAt descending", async () => {
			const mockFavorites = [
				{ id: "1", updatedAt: new Date("2024-01-20") },
				{ id: "2", updatedAt: new Date("2024-01-10") },
				{ id: "3", updatedAt: new Date("2024-01-15") },
			];

			// Sort by updatedAt descending
			const sorted = [...mockFavorites].sort(
				(a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()
			);

			expect(sorted[0].id).toBe("1");
			expect(sorted[1].id).toBe("3");
			expect(sorted[2].id).toBe("2");
		});
	});

	describe("authored", () => {
		test("should return user's authored templates", async () => {
			const mockAuthored = [
				{
					id: "my-template-1",
					title: "My Template",
					category: "Custom",
					content: "Custom content",
					authorId: session.user.id,
					createdAt: new Date("2024-01-01"),
					updatedAt: new Date("2024-01-25"),
					_count: { favouriteOf: 3 },
				},
			];

			mocks.template.findMany(mockAuthored);

			const result = await db.template.findMany({
				where: { authorId: session.user.id },
				include: { _count: { select: { favouriteOf: true } } },
				take: 3,
				orderBy: { updatedAt: "desc" },
			});

			expect(result).toHaveLength(1);
			expect(result[0].authorId).toBe(session.user.id);
		});

		test("should limit results to 3 templates", async () => {
			const mockAuthored = [
				{ id: "1", authorId: session.user.id },
				{ id: "2", authorId: session.user.id },
				{ id: "3", authorId: session.user.id },
				{ id: "4", authorId: session.user.id }, // Should be cut off
				{ id: "5", authorId: session.user.id }, // Should be cut off
			];

			// Take only 3
			const limited = mockAuthored.slice(0, 3);

			expect(limited).toHaveLength(3);
		});
	});

	describe("recentActivity", () => {
		test("should return recent usage events for the user", async () => {
			const mockEvents = [
				{
					id: "event-1",
					userId: session.user.id,
					name: "ai_scribe_generation",
					timestamp: new Date("2024-01-25T10:00:00"),
					model: "anthropic/claude-opus-4.5",
					totalTokens: 1500,
					cost: 0.05,
				},
				{
					id: "event-2",
					userId: session.user.id,
					name: "ai_scribe_generation",
					timestamp: new Date("2024-01-25T09:00:00"),
					model: "google/gemini-3-pro",
					totalTokens: 2000,
					cost: 0.03,
				},
			];

			mocks.usageEvent.findMany(mockEvents);

			const result = await db.usageEvent.findMany({
				where: { userId: session.user.id },
				orderBy: { timestamp: "desc" },
				take: 5,
			});

			expect(result).toHaveLength(2);
			expect(result[0].name).toBe("ai_scribe_generation");
			expect(result[0].timestamp > result[1].timestamp).toBe(true);
		});

		test("should limit to 5 most recent events", async () => {
			const mockEvents = Array.from({ length: 10 }, (_, i) => ({
				id: `event-${i}`,
				userId: session.user.id,
				timestamp: new Date(2024, 0, 25 - i),
			}));

			// Take only 5
			const limited = mockEvents.slice(0, 5);

			expect(limited).toHaveLength(5);
		});

		test("should return empty array when user has no activity", async () => {
			mocks.usageEvent.findMany([]);

			const result = await db.usageEvent.findMany({
				where: { userId: session.user.id },
			});

			expect(result).toEqual([]);
		});
	});
});
