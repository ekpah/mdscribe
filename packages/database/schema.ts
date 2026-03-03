import { relations } from "drizzle-orm";
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
	fromDriver(value: string): number[] {
		// Parse "[1,2,3]" format
		return value
			.slice(1, -1)
			.split(",")
			.map((v) => Number.parseFloat(v));
	},
	toDriver(value: number[]): string {
		return `[${value.join(",")}]`;
	},
});

// ============ AUTH TABLES (BetterAuth compatible) ============

export const user = pgTable("User", {
	createdAt: timestamp("createdAt", { mode: "date", precision: 3 })
		.notNull()
		.defaultNow(),
	email: text("email").notNull().unique(),
	emailVerified: boolean("emailVerified").notNull().default(false),
	id: text("id")
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	image: text("image"),
	name: text("name"),
	stripeCustomerId: text("stripeCustomerId"),
	updatedAt: timestamp("updatedAt", { mode: "date", precision: 3 })
		.notNull()
		.$onUpdate(() => new Date()),
});

export const account = pgTable("Account", {
	accessToken: text("accessToken"),
	accessTokenExpiresAt: timestamp("accessTokenExpiresAt", {
		mode: "date",
		precision: 3,
	}),
	accountId: text("accountId").notNull(),
	createdAt: timestamp("createdAt", { mode: "date", precision: 3 })
		.notNull()
		.defaultNow(),
	id: text("id")
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	idToken: text("idToken"),
	password: text("password"),
	providerId: text("providerId").notNull(),
	refreshToken: text("refreshToken"),
	refreshTokenExpiresAt: timestamp("refreshTokenExpiresAt", {
		mode: "date",
		precision: 3,
	}),
	scope: text("scope"),
	updatedAt: timestamp("updatedAt", { mode: "date", precision: 3 })
		.notNull()
		.defaultNow()
		.$onUpdate(() => new Date()),
	userId: text("userId")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
});

export const session = pgTable("Session", {
	createdAt: timestamp("createdAt", { mode: "date", precision: 3 })
		.notNull()
		.defaultNow(),
	expiresAt: timestamp("expiresAt", { mode: "date", precision: 3 }).notNull(),
	id: text("id")
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	ipAddress: text("ipAddress"),
	token: text("token").notNull().unique(),
	updatedAt: timestamp("updatedAt", { mode: "date", precision: 3 })
		.notNull()
		.defaultNow()
		.$onUpdate(() => new Date()),
	userAgent: text("userAgent"),
	userId: text("userId")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
});

export const verification = pgTable("Verification", {
	createdAt: timestamp("createdAt", { mode: "date", precision: 3 })
		.notNull()
		.defaultNow(),
	expiresAt: timestamp("expiresAt", { mode: "date", precision: 3 }).notNull(),
	id: text("id")
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	identifier: text("identifier").notNull(),
	updatedAt: timestamp("updatedAt", { mode: "date", precision: 3 })
		.notNull()
		.$onUpdate(() => new Date()),
	value: text("value").notNull(),
});

// ============ APPLICATION TABLES ============

export const template = pgTable("Template", {
	authorId: text("authorId")
		.notNull()
		.references(() => user.id),
	category: text("category").notNull(),
	content: text("content").notNull(),
	embedding: vector("embedding"),
	id: text("id")
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	title: text("title").notNull(),
	updatedAt: timestamp("updatedAt", { mode: "date", precision: 3 })
		.notNull()
		.defaultNow(),
});

export const subscription = pgTable("Subscription", {
	cancelAtPeriodEnd: boolean("cancelAtPeriodEnd"),
	createdAt: timestamp("createdAt", { mode: "date", precision: 3 })
		.notNull()
		.defaultNow(),
	id: text("id")
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	periodEnd: timestamp("periodEnd", { mode: "date", precision: 3 }),
	periodStart: timestamp("periodStart", { mode: "date", precision: 3 }),
	plan: text("plan").notNull(),
	referenceId: text("referenceId")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
	seats: integer("seats"),
	status: text("status").notNull(),
	stripeCustomerId: text("stripeCustomerId"),
	stripeSubscriptionId: text("stripeSubscriptionId"),
	trialEnd: timestamp("trialEnd", { mode: "date", precision: 3 }),
	trialStart: timestamp("trialStart", { mode: "date", precision: 3 }),
	updatedAt: timestamp("updatedAt", { mode: "date", precision: 3 })
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
		timestamp: timestamp("timestamp", { mode: "date", precision: 3 })
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
		createdAt: timestamp("createdAt", { mode: "date", precision: 3 })
			.notNull()
			.defaultNow(),
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		key: text("key").notNull(),
		snippet: text("snippet").notNull(),
		updatedAt: timestamp("updatedAt", { mode: "date", precision: 3 })
			.notNull()
			.$onUpdate(() => new Date()),
		userId: text("userId")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
	},
	(table) => [
		uniqueIndex("TextSnippet_userId_key_key").on(table.userId, table.key),
	],
);

// Many-to-many junction table for favourites
// DB columns are "A"/"B" (Prisma legacy), but we use descriptive TS names
export const favourites = pgTable(
	"_favourites",
	{
		templateId: text("A")
			.notNull()
			.references(() => template.id, { onDelete: "cascade" }),
		userId: text("B")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
	},
	(table) => [
		primaryKey({ columns: [table.templateId, table.userId] }),
		index("_favourites_B_index").on(table.userId),
	],
);

// ============ AI PROVIDER TABLES ============

export const aiProvider = pgTable("AiProvider", {
	id: text("id")
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	name: text("name").notNull(),
	// "openai-compatible" | "openrouter" | "openai" | "anthropic"
	protocol: text("protocol").notNull(),
	baseUrl: text("baseUrl"),
	apiKey: text("apiKey"),
});

export const aiModel = pgTable(
	"AiModel",
	{
		displayName: text("displayName").notNull(),
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		inputModes: text("inputModes").array().notNull().default(["text"]),
		modelId: text("modelId").notNull(),
		providerId: text("providerId")
			.notNull()
			.references(() => aiProvider.id, { onDelete: "cascade" }),
		supportsReasoning: boolean("supportsReasoning").notNull().default(false),
	},
	(table) => [
		uniqueIndex("AiModel_providerId_modelId_key").on(
			table.providerId,
			table.modelId,
		),
	],
);

export const aiDefaults = pgTable("AiDefaults", {
	defaultFileImageModelId: text("defaultFileImageModelId").references(
		() => aiModel.id,
		{ onDelete: "set null" },
	),
	defaultSpeechToTextModelId: text("defaultSpeechToTextModelId").references(
		() => aiModel.id,
		{ onDelete: "set null" },
	),
	defaultTextModelId: text("defaultTextModelId").references(() => aiModel.id, {
		onDelete: "set null",
	}),
	id: text("id")
		.primaryKey()
		.$defaultFn(() => "global"),
	updatedAt: timestamp("updatedAt", { mode: "date", precision: 3 })
		.notNull()
		.$onUpdate(() => new Date()),
});

// ============ RELATIONS ============

export const userRelations = relations(user, ({ many }) => ({
	accounts: many(account),
	favourites: many(favourites),
	sessions: many(session),
	subscriptions: many(subscription),
	templates: many(template),
	textSnippets: many(textSnippet),
	usageEvents: many(usageEvent),
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
	user: one(user, {
		fields: [subscription.referenceId],
		references: [user.id],
	}),
}));

export const usageEventRelations = relations(usageEvent, ({ one }) => ({
	user: one(user, { fields: [usageEvent.userId], references: [user.id] }),
}));

export const textSnippetRelations = relations(textSnippet, ({ one }) => ({
	user: one(user, { fields: [textSnippet.userId], references: [user.id] }),
}));

export const favouritesRelations = relations(favourites, ({ one }) => ({
	template: one(template, {
		fields: [favourites.templateId],
		references: [template.id],
	}),
	user: one(user, { fields: [favourites.userId], references: [user.id] }),
}));

export const aiProviderRelations = relations(aiProvider, ({ many }) => ({
	models: many(aiModel),
}));

export const aiModelRelations = relations(aiModel, ({ one }) => ({
	provider: one(aiProvider, {
		fields: [aiModel.providerId],
		references: [aiProvider.id],
	}),
}));
