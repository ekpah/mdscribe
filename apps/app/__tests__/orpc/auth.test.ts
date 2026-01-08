import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { account, eq, session, user, verification } from "@repo/database";
import {
	createMockSession,
	createTestContext,
	createTestUser,
	startTestServer,
	type TestServer,
} from "../setup";

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

	describe("Session Management", () => {
		test("createMockSession creates valid session object", () => {
			const mockSession = createMockSession({
				id: "user-123",
				email: "mock@example.com",
				name: "Mock User",
				stripeCustomerId: "cus_mock_123",
			});

			expect(mockSession).toBeDefined();
			expect(mockSession.user.id).toBe("user-123");
			expect(mockSession.user.email).toBe("mock@example.com");
			expect(mockSession.user.name).toBe("Mock User");
			expect(mockSession.user.stripeCustomerId).toBe("cus_mock_123");
			expect(mockSession.session.userId).toBe("user-123");
			expect(mockSession.session.token).toBeDefined();
			expect(mockSession.session.expiresAt).toBeInstanceOf(Date);
			expect(mockSession.session.expiresAt.getTime()).toBeGreaterThan(
				Date.now(),
			);
		});

		test("createMockSession uses defaults for optional fields", () => {
			const mockSession = createMockSession({
				id: "user-456",
				email: "defaults@example.com",
			});

			expect(mockSession.user.name).toBe("Test User");
			expect(mockSession.user.emailVerified).toBe(true);
			expect(mockSession.user.stripeCustomerId).toBeDefined();
			expect(mockSession.user.stripeCustomerId).toMatch(/^cus_test_/);
		});
	});

	describe("Test Context", () => {
		test("createTestContext creates context with database", () => {
			const context = createTestContext({ db: server.db });

			expect(context.db).toBe(server.db);
			expect(context.session).toBeUndefined();
		});

		test("createTestContext includes session when provided", async () => {
			const { user: testUser } = await createTestUser(server.db);
			const mockSession = createMockSession(testUser);
			const context = createTestContext({
				db: server.db,
				session: mockSession,
			});

			expect(context.db).toBe(server.db);
			expect(context.session).toBe(mockSession);
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
				id: crypto.randomUUID(),
				userId: testUser.id,
				token: sessionToken,
				expiresAt,
				ipAddress: "127.0.0.1",
				userAgent: "test-agent",
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
			const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago

			// Create expired session
			await server.db.insert(session).values({
				id: crypto.randomUUID(),
				userId: testUser.id,
				token: expiredSessionToken,
				expiresAt: pastDate,
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
				id: crypto.randomUUID(),
				userId: testUser.id,
				accountId: testUser.id,
				providerId: "credential",
				password: "hashed_password_here",
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
			const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

			await server.db.insert(verification).values({
				id: crypto.randomUUID(),
				identifier: testUser.email,
				value: verificationToken,
				expiresAt,
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
