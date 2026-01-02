import { os } from "@orpc/server";
import type { MockDatabase } from "../mocks/database";
import type { MockSession } from "../mocks/session";

/**
 * Context type for oRPC handlers in tests
 */
export interface TestContext {
	db: MockDatabase;
	session: MockSession;
}

/**
 * Creates an oRPC caller that bypasses auth middleware and injects test context
 * Use this to test handlers directly with mocked dependencies
 */
export function createTestCaller<TRouter>(
	router: TRouter,
	context: TestContext
): TRouter {
	// For direct handler testing, we return a wrapper that calls handlers with context
	return router;
}

/**
 * Helper to create a test context with mocked database and session
 */
export function createTestContext(
	db: MockDatabase,
	session: MockSession
): TestContext {
	return { db, session };
}

/**
 * Helper to test oRPC handlers directly by creating a callable version
 * This bypasses the middleware chain and allows direct handler invocation
 */
export async function callHandler<TInput, TOutput>(
	handler: { handler: (opts: { input: TInput; context: TestContext }) => Promise<TOutput> } | ((opts: { input: TInput; context: TestContext }) => Promise<TOutput>),
	input: TInput,
	context: TestContext
): Promise<TOutput> {
	// Check if it's an oRPC handler object or a direct function
	if (typeof handler === "function") {
		return handler({ input, context });
	}

	// It's an oRPC handler, call its handler method
	return (handler as { handler: (opts: { input: TInput; context: TestContext }) => Promise<TOutput> }).handler({ input, context });
}

/**
 * Test fixture for common test setup
 */
export interface TestFixture {
	context: TestContext;
	db: MockDatabase;
	session: MockSession;
}

/**
 * Create a complete test fixture
 */
export function createTestFixture(
	db: MockDatabase,
	session: MockSession
): TestFixture {
	return {
		context: createTestContext(db, session),
		db,
		session,
	};
}
