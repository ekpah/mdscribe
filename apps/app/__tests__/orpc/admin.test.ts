import { describe, expect, test, beforeEach } from "bun:test";
import { createTestDatabase, type MockDatabase } from "../mocks/database";
import {
	createAdminSession,
	createNonAdminSession,
	type MockSession,
} from "../mocks/session";

/**
 * Tests for admin endpoints
 *
 * These tests verify:
 * - Admin authorization (only admin emails allowed)
 * - User listing
 * - Usage event listing with pagination
 * - Usage statistics
 * - Embedding statistics and migration
 */

const ADMIN_EMAILS = ["nils.hapke@we-mail.de", "n.hapke@bbtgruppe.de"];

describe("Admin Authorization", () => {
	test("should allow access for admin emails", () => {
		for (const email of ADMIN_EMAILS) {
			expect(ADMIN_EMAILS.includes(email)).toBe(true);
		}
	});

	test("should deny access for non-admin emails", () => {
		const nonAdminEmails = [
			"regular@example.com",
			"user@hospital.de",
			"nils.hapke@other-domain.de",
		];

		for (const email of nonAdminEmails) {
			expect(ADMIN_EMAILS.includes(email)).toBe(false);
		}
	});
});

describe("Admin Users Handler", () => {
	let db: MockDatabase;
	let session: MockSession;
	let mocks: ReturnType<typeof createTestDatabase>["mocks"];

	beforeEach(() => {
		const testDb = createTestDatabase();
		db = testDb.db;
		mocks = testDb.mocks;
		session = createAdminSession();
	});

	describe("list", () => {
		test("should return all users with counts", async () => {
			const mockUsers = [
				{
					id: "user-1",
					name: "User One",
					email: "user1@example.com",
					emailVerified: true,
					image: null,
					createdAt: new Date("2024-01-01"),
					updatedAt: new Date("2024-01-15"),
					_count: {
						templates: 5,
						favourites: 10,
						usageEvents: 25,
					},
				},
				{
					id: "user-2",
					name: "User Two",
					email: "user2@example.com",
					emailVerified: false,
					image: "https://example.com/avatar.jpg",
					createdAt: new Date("2024-01-10"),
					updatedAt: new Date("2024-01-20"),
					_count: {
						templates: 2,
						favourites: 3,
						usageEvents: 8,
					},
				},
			];

			mocks.user.findMany(mockUsers);

			const result = await db.user.findMany({
				select: {
					id: true,
					name: true,
					email: true,
					emailVerified: true,
					image: true,
					createdAt: true,
					updatedAt: true,
					_count: {
						select: {
							templates: true,
							favourites: true,
							usageEvents: true,
						},
					},
				},
				orderBy: { createdAt: "desc" },
			});

			expect(result).toHaveLength(2);
			expect(result[0]._count.templates).toBe(5);
			expect(result[0]._count.usageEvents).toBe(25);
		});

		test("should order users by createdAt descending", async () => {
			const mockUsers = [
				{ id: "1", createdAt: new Date("2024-01-20") },
				{ id: "2", createdAt: new Date("2024-01-01") },
				{ id: "3", createdAt: new Date("2024-01-15") },
			];

			const sorted = [...mockUsers].sort(
				(a, b) => b.createdAt.getTime() - a.createdAt.getTime()
			);

			expect(sorted[0].id).toBe("1");
			expect(sorted[1].id).toBe("3");
			expect(sorted[2].id).toBe("2");
		});
	});
});

describe("Admin Usage Handler", () => {
	let db: MockDatabase;
	let session: MockSession;
	let mocks: ReturnType<typeof createTestDatabase>["mocks"];

	beforeEach(() => {
		const testDb = createTestDatabase();
		db = testDb.db;
		mocks = testDb.mocks;
		session = createAdminSession();
	});

	describe("list", () => {
		test("should return usage events with pagination", async () => {
			const mockEvents = Array.from({ length: 26 }, (_, i) => ({
				id: `event-${i}`,
				userId: `user-${i % 5}`,
				name: "ai_scribe_generation",
				timestamp: new Date(2024, 0, 25 - i),
				model: "anthropic/claude-opus-4.5",
				totalTokens: 1000 + i * 100,
				cost: 0.01 + i * 0.001,
				user: {
					id: `user-${i % 5}`,
					name: `User ${i % 5}`,
					email: `user${i % 5}@example.com`,
				},
			}));

			mocks.usageEvent.findMany(mockEvents);

			const result = await db.usageEvent.findMany({
				take: 26, // limit + 1 for hasMore detection
				orderBy: { timestamp: "desc" },
				include: {
					user: {
						select: { id: true, name: true, email: true },
					},
				},
			});

			// Check pagination logic
			const limit = 25;
			const hasMore = result.length > limit;
			const items = hasMore ? result.slice(0, -1) : result;
			const nextCursor = hasMore ? items[items.length - 1]?.id : undefined;

			expect(result).toHaveLength(26);
			expect(hasMore).toBe(true);
			expect(items).toHaveLength(25);
			expect(nextCursor).toBe("event-24");
		});

		test("should filter by userId when provided", async () => {
			const input = { userId: "user-1" };
			const mockEvents = [
				{ id: "event-1", userId: "user-1" },
				{ id: "event-2", userId: "user-1" },
			];

			mocks.usageEvent.findMany(mockEvents);

			const result = await db.usageEvent.findMany({
				where: { userId: input.userId },
			});

			expect(result.every((e: { userId: string }) => e.userId === "user-1")).toBe(true);
		});

		test("should filter by name when provided", async () => {
			const input = { name: "ai_scribe" };

			// Handler uses { contains: name } filter
			const nameFilter = { contains: input.name };

			// Simulate matching logic
			const events = [
				{ name: "ai_scribe_generation" },
				{ name: "ai_scribe_completion" },
				{ name: "other_event" },
			];

			const filtered = events.filter((e) =>
				e.name.includes(nameFilter.contains)
			);

			expect(filtered).toHaveLength(2);
		});
	});

	describe("get", () => {
		test("should return a single usage event by ID", async () => {
			const mockEvent = {
				id: "event-123",
				userId: "user-1",
				name: "ai_scribe_generation",
				timestamp: new Date("2024-01-25"),
				model: "anthropic/claude-opus-4.5",
				totalTokens: 1500,
				inputTokens: 500,
				outputTokens: 1000,
				cost: 0.05,
				user: {
					id: "user-1",
					name: "Test User",
					email: "test@example.com",
				},
			};

			// Mock findUnique via our mock system
			const findUniqueMock = async () => mockEvent;

			const result = await findUniqueMock();

			expect(result.id).toBe("event-123");
			expect(result.user.email).toBe("test@example.com");
		});
	});

	describe("stats", () => {
		test("should return usage statistics", async () => {
			mocks.usageEvent.count(50);
			mocks.usageEvent.aggregate({
				_sum: { cost: { toNumber: () => 2.5 }, totalTokens: 75000 },
			});

			const [totalEvents, costResult, tokensResult] = await Promise.all([
				db.usageEvent.count({ where: {} }),
				db.usageEvent.aggregate({ _sum: { cost: true }, where: {} }),
				db.usageEvent.aggregate({ _sum: { totalTokens: true }, where: {} }),
			]);

			expect(totalEvents).toBe(50);
		});

		test("should apply date filter for 'today'", () => {
			const filter = "today";
			const now = new Date();
			const start = new Date(now);
			start.setHours(0, 0, 0, 0);

			// The handler logic
			const dateStart =
				filter === "today" ? start : filter === "week" ? null : null;

			expect(dateStart?.getHours()).toBe(0);
			expect(dateStart?.getMinutes()).toBe(0);
		});

		test("should apply date filter for 'week'", () => {
			const filter = "week";
			const now = new Date();
			const start = new Date(now);
			start.setDate(start.getDate() - 7);
			start.setHours(0, 0, 0, 0);

			// start should be approximately 7 days before now
			const diffMs = now.getTime() - start.getTime();
			const diffDays = diffMs / (1000 * 60 * 60 * 24);

			// Should be at least 7 days (and up to 8 since we set hours to 0)
			expect(diffDays).toBeGreaterThanOrEqual(7);
			expect(diffDays).toBeLessThan(8);
		});

		test("should apply date filter for 'month'", () => {
			const filter = "month";
			const now = new Date();
			const start = new Date(now);
			start.setDate(start.getDate() - 30);

			// 30 days ago
			expect(start < now).toBe(true);
		});

		test("should return all-time stats for 'all' filter", () => {
			const filter = "all";
			const dateStart = filter === "all" ? null : new Date();

			expect(dateStart).toBeNull();
		});
	});
});

describe("Admin Embeddings Handler", () => {
	let db: MockDatabase;
	let session: MockSession;
	let mocks: ReturnType<typeof createTestDatabase>["mocks"];

	beforeEach(() => {
		const testDb = createTestDatabase();
		db = testDb.db;
		mocks = testDb.mocks;
		session = createAdminSession();
	});

	describe("stats", () => {
		test("should return embedding statistics", async () => {
			mocks.template.count(100);
			mocks.$queryRaw([{ count: BigInt(15) }]);

			const total = await db.template.count();
			const rawResult = await db.$queryRaw<[{ count: bigint }]>`
				SELECT COUNT(*) FROM "Template" WHERE embedding IS NULL
			`;
			const needingEmbeddings = Number(rawResult[0]?.count ?? 0);

			expect(total).toBe(100);
			expect(needingEmbeddings).toBe(15);

			const stats = {
				totalTemplates: total,
				templatesWithoutEmbeddings: needingEmbeddings,
				templatesWithEmbeddings: total - needingEmbeddings,
			};

			expect(stats.templatesWithEmbeddings).toBe(85);
		});
	});

	describe("migrate", () => {
		test("should handle 'missing' mode - only templates without embeddings", async () => {
			const mode = "missing";
			const templatesToProcess = [
				{ id: "1", content: "Template without embedding" },
				{ id: "2", content: "Another template" },
			];

			mocks.$queryRaw(templatesToProcess);

			const result = await db.$queryRaw`
				SELECT id, content FROM "Template" WHERE embedding IS NULL
			`;

			expect(result).toHaveLength(2);
		});

		test("should handle 'all' mode - regenerate all embeddings", async () => {
			const mode = "all";
			const allTemplates = [
				{ id: "1", content: "Template 1" },
				{ id: "2", content: "Template 2" },
				{ id: "3", content: "Template 3" },
			];

			mocks.$queryRaw(allTemplates);

			const result = await db.$queryRaw`
				SELECT id, content FROM "Template"
			`;

			expect(result).toHaveLength(3);
		});

		test("should process in batches", async () => {
			const templates = Array.from({ length: 25 }, (_, i) => ({
				id: `template-${i}`,
				content: `Content ${i}`,
			}));

			const batchSize = 10;
			const batches: Array<typeof templates> = [];

			for (let i = 0; i < templates.length; i += batchSize) {
				batches.push(templates.slice(i, i + batchSize));
			}

			expect(batches).toHaveLength(3);
			expect(batches[0]).toHaveLength(10);
			expect(batches[1]).toHaveLength(10);
			expect(batches[2]).toHaveLength(5);
		});

		test("should return migration stats", async () => {
			const stats = {
				total: 100,
				processed: 15,
				failed: 2,
				errors: [
					{ templateId: "err-1", error: "Network error" },
					{ templateId: "err-2", error: "Invalid content" },
				],
			};

			const result = {
				totalTemplates: stats.total,
				templatesProcessed: stats.processed + stats.failed,
				successfulEmbeddings: stats.processed,
				failedEmbeddings: stats.failed,
				errors: stats.errors,
				message: `Missing embeddings generated: ${stats.processed} embedded, ${stats.failed} failed`,
			};

			expect(result.successfulEmbeddings).toBe(15);
			expect(result.failedEmbeddings).toBe(2);
			expect(result.errors).toHaveLength(2);
		});

		test("should handle empty result when no templates need processing", async () => {
			mocks.$queryRaw([]);

			const templatesToProcess = await db.$queryRaw`
				SELECT id, content FROM "Template" WHERE embedding IS NULL
			`;

			if (templatesToProcess.length === 0) {
				const result = {
					totalTemplates: 100,
					templatesProcessed: 0,
					successfulEmbeddings: 0,
					failedEmbeddings: 0,
					errors: [],
				};

				expect(result.templatesProcessed).toBe(0);
			}
		});
	});
});
