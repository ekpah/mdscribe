import { relations, sql } from "drizzle-orm";
import {
	boolean,
	customType,
	index,
	integer,
	jsonb,
	numeric,
	pgTable,
	primaryKey,
	text,
	timestamp,
	uniqueIndex,
} from "drizzle-orm/pg-core";

// Custom vector type for pgvector
const vector = customType<{ data: number[]; driverData: string }>({
	dataType() {
		return "vector(1024)";
	},
	toDriver(value: number[]): string {
		return `[${value.join(",")}]`;
	},
	fromDriver(value: string): number[] {
		// Parse "[1,2,3]" format
		return value
			.slice(1, -1)
			.split(",")
			.map((v) => Number.parseFloat(v));
	},
});

// Helper to generate cuid-like IDs (using crypto.randomUUID as fallback)
const cuid = () =>
	sql`substring(md5(random()::text || clock_timestamp()::text), 1, 25)`;

// ============ AUTH TABLES (BetterAuth compatible) ============

export const user = pgTable("User", {
	id: text("id")
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	name: text("name"),
	email: text("email").notNull().unique(),
	emailVerified: boolean("emailVerified").notNull().default(false),
	image: text("image"),
	createdAt: timestamp("createdAt", { precision: 3, mode: "date" })
		.notNull()
		.defaultNow(),
	updatedAt: timestamp("updatedAt", { precision: 3, mode: "date" })
		.notNull()
		.$onUpdate(() => new Date()),
	stripeCustomerId: text("stripeCustomerId"),
});

export const account = pgTable("Account", {
	id: text("id")
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	userId: text("userId")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
	accountId: text("accountId").notNull(),
	providerId: text("providerId").notNull(),
	accessToken: text("accessToken"),
	refreshToken: text("refreshToken"),
	accessTokenExpiresAt: timestamp("accessTokenExpiresAt", {
		precision: 3,
		mode: "date",
	}),
	refreshTokenExpiresAt: timestamp("refreshTokenExpiresAt", {
		precision: 3,
		mode: "date",
	}),
	scope: text("scope"),
	idToken: text("idToken"),
	password: text("password"),
	createdAt: timestamp("createdAt", { precision: 3, mode: "date" })
		.notNull()
		.defaultNow(),
	updatedAt: timestamp("updatedAt", { precision: 3, mode: "date" })
		.notNull()
		.$onUpdate(() => new Date()),
});

export const session = pgTable("Session", {
	id: text("id")
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	userId: text("userId")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
	token: text("token").notNull().unique(),
	expiresAt: timestamp("expiresAt", { precision: 3, mode: "date" }).notNull(),
	ipAddress: text("ipAddress"),
	userAgent: text("userAgent"),
	createdAt: timestamp("createdAt", { precision: 3, mode: "date" })
		.notNull()
		.defaultNow(),
	updatedAt: timestamp("updatedAt", { precision: 3, mode: "date" })
		.notNull()
		.$onUpdate(() => new Date()),
});

export const verification = pgTable("Verification", {
	id: text("id")
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	identifier: text("identifier").notNull(),
	value: text("value").notNull(),
	expiresAt: timestamp("expiresAt", { precision: 3, mode: "date" }).notNull(),
	createdAt: timestamp("createdAt", { precision: 3, mode: "date" })
		.notNull()
		.defaultNow(),
	updatedAt: timestamp("updatedAt", { precision: 3, mode: "date" })
		.notNull()
		.$onUpdate(() => new Date()),
});

// ============ APPLICATION TABLES ============

export const template = pgTable("Template", {
	id: text("id")
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	title: text("title").notNull(),
	category: text("category").notNull(),
	content: text("content").notNull(),
	authorId: text("authorId")
		.notNull()
		.references(() => user.id),
	updatedAt: timestamp("updatedAt", { precision: 3, mode: "date" })
		.notNull()
		.defaultNow(),
	embedding: vector("embedding"),
});

export const subscription = pgTable("Subscription", {
	id: text("id")
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	plan: text("plan").notNull(),
	referenceId: text("referenceId")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
	stripeCustomerId: text("stripeCustomerId"),
	stripeSubscriptionId: text("stripeSubscriptionId"),
	status: text("status").notNull(),
	periodStart: timestamp("periodStart", { precision: 3, mode: "date" }),
	periodEnd: timestamp("periodEnd", { precision: 3, mode: "date" }),
	cancelAtPeriodEnd: boolean("cancelAtPeriodEnd"),
	seats: integer("seats"),
	trialStart: timestamp("trialStart", { precision: 3, mode: "date" }),
	trialEnd: timestamp("trialEnd", { precision: 3, mode: "date" }),
	createdAt: timestamp("createdAt", { precision: 3, mode: "date" })
		.notNull()
		.defaultNow(),
	updatedAt: timestamp("updatedAt", { precision: 3, mode: "date" })
		.notNull()
		.$onUpdate(() => new Date()),
});

export const usageEvent = pgTable(
	"UsageEvent",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		userId: text("userId")
			.notNull()
			.references(() => user.id),
		timestamp: timestamp("timestamp", { precision: 3, mode: "date" })
			.notNull()
			.defaultNow(),
		name: text("name").notNull(),
		// Token usage
		inputTokens: integer("inputTokens"),
		outputTokens: integer("outputTokens"),
		totalTokens: integer("totalTokens"),
		reasoningTokens: integer("reasoningTokens"),
		cachedTokens: integer("cachedTokens"),
		// Cost (Decimal(10, 6))
		cost: numeric("cost", { precision: 10, scale: 6 }),
		// Model used
		model: text("model"),
		// Flexible JSON fields
		inputData: jsonb("inputData"),
		metadata: jsonb("metadata"),
		// AI output
		result: text("result"),
		reasoning: text("reasoning"),
	},
	(table) => [
		index("UsageEvent_userId_timestamp_idx").on(table.userId, table.timestamp),
		index("UsageEvent_name_timestamp_idx").on(table.name, table.timestamp),
	],
);

export const textSnippet = pgTable(
	"TextSnippet",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		userId: text("userId")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		key: text("key").notNull(),
		snippet: text("snippet").notNull(),
		createdAt: timestamp("createdAt", { precision: 3, mode: "date" })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updatedAt", { precision: 3, mode: "date" })
			.notNull()
			.$onUpdate(() => new Date()),
	},
	(table) => [uniqueIndex("TextSnippet_userId_key_key").on(table.userId, table.key)],
);

// Many-to-many junction table for favourites
// Prisma creates columns named "A" and "B" for implicit many-to-many
export const favourites = pgTable(
	"_favourites",
	{
		A: text("A")
			.notNull()
			.references(() => template.id, { onDelete: "cascade" }),
		B: text("B")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
	},
	(table) => [
		primaryKey({ columns: [table.A, table.B] }),
		index("_favourites_B_index").on(table.B),
	],
);

// ============ RELATIONS ============

export const userRelations = relations(user, ({ many }) => ({
	accounts: many(account),
	sessions: many(session),
	subscriptions: many(subscription),
	templates: many(template),
	textSnippets: many(textSnippet),
	usageEvents: many(usageEvent),
	favourites: many(favourites),
}));

export const accountRelations = relations(account, ({ one }) => ({
	user: one(user, { fields: [account.userId], references: [user.id] }),
}));

export const sessionRelations = relations(session, ({ one }) => ({
	user: one(user, { fields: [session.userId], references: [user.id] }),
}));

export const templateRelations = relations(template, ({ one, many }) => ({
	author: one(user, { fields: [template.authorId], references: [user.id] }),
	favouriteOf: many(favourites),
}));

export const subscriptionRelations = relations(subscription, ({ one }) => ({
	user: one(user, { fields: [subscription.referenceId], references: [user.id] }),
}));

export const usageEventRelations = relations(usageEvent, ({ one }) => ({
	user: one(user, { fields: [usageEvent.userId], references: [user.id] }),
}));

export const textSnippetRelations = relations(textSnippet, ({ one }) => ({
	user: one(user, { fields: [textSnippet.userId], references: [user.id] }),
}));

export const favouritesRelations = relations(favourites, ({ one }) => ({
	template: one(template, { fields: [favourites.A], references: [template.id] }),
	user: one(user, { fields: [favourites.B], references: [user.id] }),
}));
