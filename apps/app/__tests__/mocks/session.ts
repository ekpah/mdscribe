/**
 * Mock session factory for testing authenticated oRPC handlers
 */
export interface MockUser {
	id: string;
	name: string;
	email: string;
	emailVerified: boolean;
	image: string | null;
	createdAt: Date;
	updatedAt: Date;
	stripeCustomerId: string | null;
	role?: string;
}

export interface MockSession {
	user: MockUser;
	session: {
		id: string;
		createdAt: Date;
		updatedAt: Date;
		userId: string;
		expiresAt: Date;
		token: string;
		ipAddress: string | null;
		userAgent: string | null;
	};
}

/**
 * Create a mock user for testing
 */
export function createMockUser(overrides: Partial<MockUser> = {}): MockUser {
	return {
		id: "test-user-id",
		name: "Test User",
		email: "test@example.com",
		emailVerified: true,
		image: null,
		createdAt: new Date("2024-01-01"),
		updatedAt: new Date("2024-01-01"),
		stripeCustomerId: "cus_test123",
		...overrides,
	};
}

/**
 * Create a mock session for testing
 */
export function createMockSession(userOverrides: Partial<MockUser> = {}): MockSession {
	const user = createMockUser(userOverrides);
	return {
		user,
		session: {
			id: "test-session-id",
			createdAt: new Date(),
			updatedAt: new Date(),
			userId: user.id,
			expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
			token: "test-token",
			ipAddress: "127.0.0.1",
			userAgent: "test-agent",
		},
	};
}

/**
 * Create an admin session for testing admin endpoints
 */
export function createAdminSession(): MockSession {
	return createMockSession({
		email: "nils.hapke@we-mail.de", // Admin email from middlewares/admin.ts
		name: "Admin User",
	});
}

/**
 * Create a non-admin session for testing authorization
 */
export function createNonAdminSession(): MockSession {
	return createMockSession({
		email: "regular@example.com",
		name: "Regular User",
	});
}

/**
 * Create a session without Stripe customer ID (for testing subscription checks)
 */
export function createSessionWithoutStripe(): MockSession {
	return createMockSession({
		stripeCustomerId: null,
	});
}
