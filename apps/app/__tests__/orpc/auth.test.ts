import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { account, eq, session, user, verification } from "@repo/database";
import { createTestContext, createTestUser, startTestServer } from "@/__tests__/setup";
import type { TestServer } from "@/__tests__/setup";

/**
 * Authentication flow tests
 *
 * Tests for:
 * - User creation and session management
 * - Authentication middleware behavior
 * - Session validation
 *
 * Note: These tests use the test database directly to create
 * authentication states, rather than going through BetterAuth's
 * HTTP endpoints, to isolate the oRPC handler testing from
 * the full auth stack.
 */

describe("Authentication Flow", () => {
	let server: TestServer;

	beforeEach(async () => {
		server = await startTestServer("auth-test");
	});

	afterEach(async () => {
		await server.close();
	});

	describe("User Management", () => {
		test("createTestUser creates user with required fields", async () => {
			const { user: testUser, session: testSession } = await createTestUser(
				server.db,
				{
					email: "test@example.com",
					name: "Test User",
					stripeCustomerId: "cus_test_123",
				},
			);

			expect(testUser).toBeDefined();
			expect(testUser.id).toBeDefined();
			expect(testUser.email).toBe("test@example.com");
			expect(testUser.name).toBe("Test User");
			expect(testUser.emailVerified).toBe(true);
			expect(testUser.stripeCustomerId).toBe("cus_test_123");

			expect(testSession).toBeDefined();
			expect(testSession.user.id).toBe(testUser.id);
		});

		test("createTestUser generates unique IDs for each user", async () => {
			const { user: user1 } = await createTestUser(server.db, {
				email: "user1@example.com",
			});
			const { user: user2 } = await createTestUser(server.db, {
				email: "user2@example.com",
			});

			expect(user1.id).not.toBe(user2.id);
		});

		test("user is persisted to database", async () => {
			const { user: testUser } = await createTestUser(server.db, {
				email: "persistent@example.com",
			});

			// Verify user exists in database
			const [dbUser] = await server.db
				.select()
				.from(user)
				.where(eq(user.id, testUser.id))
				.limit(1);

			expect(dbUser).toBeDefined();
			expect(dbUser!.email).toBe("persistent@example.com");
		});
	});

	describe("Test Context", () => {
		test("createTestContext creates context with database", () => {
			const context = createTestContext({ db: server.db });

			expect(context.db).toBe(server.db);
			expect(context.session).toBeUndefined();
		});

		test("createTestContext includes session when provided", async () => {
			const { session: testSession, user: testUser } =
				await createTestUser(server.db);
			const context = createTestContext({
				db: server.db,
				session: testSession,
			});

			expect(context.db).toBe(server.db);
			expect(context.session).toBe(testSession);
			expect(context.session?.user.id).toBe(testUser.id);
		});
	});

	describe("Database Session Storage", () => {
		test("can create and retrieve session from database", async () => {
			const { user: testUser } = await createTestUser(server.db);
			const sessionToken = crypto.randomUUID();
			const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

			// Create session in database
			await server.db.insert(session).values({
				expiresAt,
				id: crypto.randomUUID(),
				ipAddress: "127.0.0.1",
				token: sessionToken,
				userAgent: "test-agent",
				userId: testUser.id,
			});

			// Retrieve session
			const [dbSession] = await server.db
				.select()
				.from(session)
				.where(eq(session.token, sessionToken))
				.limit(1);

			expect(dbSession).toBeDefined();
			expect(dbSession!.userId).toBe(testUser.id);
			expect(dbSession!.token).toBe(sessionToken);
		});

		test("expired sessions can be identified", async () => {
			const { user: testUser } = await createTestUser(server.db);
			const expiredSessionToken = crypto.randomUUID();
			// 24 hours ago
			const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);

			// Create expired session
			await server.db.insert(session).values({
				expiresAt: pastDate,
				id: crypto.randomUUID(),
				token: expiredSessionToken,
				userId: testUser.id,
			});

			// Retrieve session
			const [dbSession] = await server.db
				.select()
				.from(session)
				.where(eq(session.token, expiredSessionToken))
				.limit(1);

			expect(dbSession).toBeDefined();
			expect(dbSession!.expiresAt.getTime()).toBeLessThan(Date.now());
		});
	});

	describe("Account Linking", () => {
		test("can create account linked to user", async () => {
			const { user: testUser } = await createTestUser(server.db);

			// Create an email/password account
			await server.db.insert(account).values({
				accountId: testUser.id,
				id: crypto.randomUUID(),
				password: "hashed_password_here",
				providerId: "credential",
				userId: testUser.id,
			});

			// Retrieve account
			const [dbAccount] = await server.db
				.select()
				.from(account)
				.where(eq(account.userId, testUser.id))
				.limit(1);

			expect(dbAccount).toBeDefined();
			expect(dbAccount!.providerId).toBe("credential");
			expect(dbAccount!.userId).toBe(testUser.id);
		});
	});

	describe("Email Verification", () => {
		test("can create verification token", async () => {
			const { user: testUser } = await createTestUser(server.db);
			const verificationToken = crypto.randomUUID();
			// 1 hour
			const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

			await server.db.insert(verification).values({
				expiresAt,
				id: crypto.randomUUID(),
				identifier: testUser.email,
				value: verificationToken,
			});

			const [dbVerification] = await server.db
				.select()
				.from(verification)
				.where(eq(verification.value, verificationToken))
				.limit(1);

			expect(dbVerification).toBeDefined();
			expect(dbVerification!.identifier).toBe(testUser.email);
		});
	});
});
