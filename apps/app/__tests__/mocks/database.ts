import type { PrismaClient, Prisma } from "@repo/database";

/**
 * Mock database factory for testing oRPC handlers
 * Returns a mock PrismaClient with chainable methods
 */
export function createMockDatabase(overrides: Partial<MockDatabase> = {}): MockDatabase {
	const defaultMocks: MockDatabase = {
		user: createMockModel(),
		template: createMockModel(),
		subscription: createMockModel(),
		usageEvent: createMockModel(),
		textSnippet: createMockModel(),
		session: createMockModel(),
		account: createMockModel(),
		verification: createMockModel(),
		$queryRaw: async () => [],
		$executeRaw: async () => 0,
		$transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(defaultMocks),
	};

	return { ...defaultMocks, ...overrides };
}

interface MockModel {
	findUnique: ReturnType<typeof createAsyncMock>;
	findFirst: ReturnType<typeof createAsyncMock>;
	findMany: ReturnType<typeof createAsyncMock>;
	create: ReturnType<typeof createAsyncMock>;
	update: ReturnType<typeof createAsyncMock>;
	delete: ReturnType<typeof createAsyncMock>;
	count: ReturnType<typeof createAsyncMock>;
	aggregate: ReturnType<typeof createAsyncMock>;
}

function createAsyncMock() {
	const mock = Object.assign(
		async (..._args: unknown[]) => null,
		{
			mockResolvedValue: (value: unknown) => {
				const fn = Object.assign(
					async () => value,
					{ mockResolvedValue: mock.mockResolvedValue }
				);
				return fn;
			},
		}
	);
	return mock;
}

function createMockModel(): MockModel {
	return {
		findUnique: createAsyncMock(),
		findFirst: createAsyncMock(),
		findMany: createAsyncMock(),
		create: createAsyncMock(),
		update: createAsyncMock(),
		delete: createAsyncMock(),
		count: createAsyncMock(),
		aggregate: createAsyncMock(),
	};
}

export interface MockDatabase {
	user: MockModel;
	template: MockModel;
	subscription: MockModel;
	usageEvent: MockModel;
	textSnippet: MockModel;
	session: MockModel;
	account: MockModel;
	verification: MockModel;
	$queryRaw: <T = unknown>(...args: unknown[]) => Promise<T[]>;
	$executeRaw: (...args: unknown[]) => Promise<number>;
	$transaction: <T>(fn: (tx: unknown) => Promise<T>) => Promise<T>;
}

/**
 * Helper to create a fully-typed mock database with specific return values
 */
export function createTestDatabase(): {
	db: MockDatabase;
	mocks: {
		template: {
			findUnique: (value: unknown) => void;
			findMany: (value: unknown) => void;
			count: (value: number) => void;
		};
		usageEvent: {
			findMany: (value: unknown) => void;
			create: (value: unknown) => void;
			count: (value: number) => void;
			aggregate: (value: unknown) => void;
		};
		textSnippet: {
			findFirst: (value: unknown) => void;
			findMany: (value: unknown) => void;
			create: (value: unknown) => void;
			update: (value: unknown) => void;
			delete: (value: unknown) => void;
		};
		subscription: {
			findMany: (value: unknown) => void;
		};
		user: {
			findMany: (value: unknown) => void;
		};
		$queryRaw: (value: unknown[]) => void;
	};
} {
	const templateMocks = {
		findUnique: null as unknown,
		findMany: [] as unknown[],
		count: 0,
	};

	const usageEventMocks = {
		findMany: [] as unknown[],
		create: null as unknown,
		count: 0,
		aggregate: { _sum: { cost: null, totalTokens: null } },
	};

	const textSnippetMocks = {
		findFirst: null as unknown,
		findMany: [] as unknown[],
		create: null as unknown,
		update: null as unknown,
		delete: null as unknown,
	};

	const subscriptionMocks = {
		findMany: [] as unknown[],
	};

	const userMocks = {
		findMany: [] as unknown[],
	};

	let queryRawResult: unknown[] = [];

	const db: MockDatabase = {
		template: {
			findUnique: async () => templateMocks.findUnique,
			findFirst: async () => null,
			findMany: async () => templateMocks.findMany,
			create: async () => null,
			update: async () => null,
			delete: async () => null,
			count: async () => templateMocks.count,
			aggregate: async () => ({}),
		} as MockModel,
		usageEvent: {
			findUnique: async () => null,
			findFirst: async () => null,
			findMany: async () => usageEventMocks.findMany,
			create: async () => usageEventMocks.create,
			update: async () => null,
			delete: async () => null,
			count: async () => usageEventMocks.count,
			aggregate: async () => usageEventMocks.aggregate,
		} as MockModel,
		textSnippet: {
			findUnique: async () => null,
			findFirst: async () => textSnippetMocks.findFirst,
			findMany: async () => textSnippetMocks.findMany,
			create: async () => textSnippetMocks.create,
			update: async () => textSnippetMocks.update,
			delete: async () => textSnippetMocks.delete,
			count: async () => 0,
			aggregate: async () => ({}),
		} as MockModel,
		subscription: {
			findUnique: async () => null,
			findFirst: async () => null,
			findMany: async () => subscriptionMocks.findMany,
			create: async () => null,
			update: async () => null,
			delete: async () => null,
			count: async () => 0,
			aggregate: async () => ({}),
		} as MockModel,
		user: {
			findUnique: async () => null,
			findFirst: async () => null,
			findMany: async () => userMocks.findMany,
			create: async () => null,
			update: async () => null,
			delete: async () => null,
			count: async () => 0,
			aggregate: async () => ({}),
		} as MockModel,
		session: createMockModel(),
		account: createMockModel(),
		verification: createMockModel(),
		$queryRaw: async () => queryRawResult,
		$executeRaw: async () => 0,
		$transaction: async (fn) => fn(db),
	};

	return {
		db,
		mocks: {
			template: {
				findUnique: (value: unknown) => { templateMocks.findUnique = value; },
				findMany: (value: unknown) => { templateMocks.findMany = value as unknown[]; },
				count: (value: number) => { templateMocks.count = value; },
			},
			usageEvent: {
				findMany: (value: unknown) => { usageEventMocks.findMany = value as unknown[]; },
				create: (value: unknown) => { usageEventMocks.create = value; },
				count: (value: number) => { usageEventMocks.count = value; },
				aggregate: (value: unknown) => { usageEventMocks.aggregate = value as typeof usageEventMocks.aggregate; },
			},
			textSnippet: {
				findFirst: (value: unknown) => { textSnippetMocks.findFirst = value; },
				findMany: (value: unknown) => { textSnippetMocks.findMany = value as unknown[]; },
				create: (value: unknown) => { textSnippetMocks.create = value; },
				update: (value: unknown) => { textSnippetMocks.update = value; },
				delete: (value: unknown) => { textSnippetMocks.delete = value; },
			},
			subscription: {
				findMany: (value: unknown) => { subscriptionMocks.findMany = value as unknown[]; },
			},
			user: {
				findMany: (value: unknown) => { userMocks.findMany = value as unknown[]; },
			},
			$queryRaw: (value: unknown[]) => { queryRawResult = value; },
		},
	};
}
