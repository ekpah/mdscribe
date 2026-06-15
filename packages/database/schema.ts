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
	real,
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

const bytea = customType<{ data: Uint8Array; driverData: Uint8Array | string }>({
	dataType() {
		return "bytea";
	},
	fromDriver(value: Uint8Array | string): Uint8Array {
		if (value instanceof Uint8Array) {
			return value;
		}
		const normalized = value.startsWith("\\x") ? value.slice(2) : value;
		return new Uint8Array(Buffer.from(normalized, "hex"));
	},
	toDriver(value: Uint8Array): Uint8Array {
		return value;
	},
});

// ============ AUTH TABLES (BetterAuth compatible) ============

export const user = pgTable("User", {
	createdAt: timestamp("createdAt", { mode: "date", precision: 3 }).notNull().defaultNow(),
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
	createdAt: timestamp("createdAt", { mode: "date", precision: 3 }).notNull().defaultNow(),
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
	createdAt: timestamp("createdAt", { mode: "date", precision: 3 }).notNull().defaultNow(),
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
	createdAt: timestamp("createdAt", { mode: "date", precision: 3 }).notNull().defaultNow(),
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

export const template = pgTable(
	"Template",
	{
		authorId: text("authorId")
			.notNull()
			.references(() => user.id),
		category: text("category").notNull(),
		content: text("content").notNull(),
		embedding: vector("embedding"),
		examples: text("examples").array().notNull().default([]),
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		title: text("title").notNull(),
		updatedAt: timestamp("updatedAt", { mode: "date", precision: 3 }).notNull().defaultNow(),
		visibility: text("visibility").notNull().default("public"),
	},
	(table) => [
		index("Template_authorId_visibility_idx").on(table.authorId, table.visibility),
		index("Template_visibility_idx").on(table.visibility),
	],
);

export const documentTemplate = pgTable(
	"DocumentTemplate",
	{
		authorId: text("authorId")
			.notNull()
			.references(() => user.id),
		category: text("category").notNull(),
		createdAt: timestamp("createdAt", { mode: "date", precision: 3 }).notNull().defaultNow(),
		fieldDefinitions: jsonb("fieldDefinitions").notNull(),
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		pdfBytes: bytea("pdfBytes").notNull(),
		title: text("title").notNull(),
		updatedAt: timestamp("updatedAt", { mode: "date", precision: 3 })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
		visibility: text("visibility").notNull().default("public"),
	},
	(table) => [
		index("DocumentTemplate_authorId_idx").on(table.authorId),
		index("DocumentTemplate_authorId_visibility_idx").on(table.authorId, table.visibility),
		index("DocumentTemplate_category_idx").on(table.category),
		index("DocumentTemplate_visibility_idx").on(table.visibility),
	],
);

export const templateCollection = pgTable("TemplateCollection", {
	createdAt: timestamp("createdAt", { mode: "date", precision: 3 }).notNull().defaultNow(),
	description: text("description"),
	id: text("id")
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	name: text("name").notNull(),
	updatedAt: timestamp("updatedAt", { mode: "date", precision: 3 })
		.notNull()
		.defaultNow()
		.$onUpdate(() => new Date()),
	userId: text("userId")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
});

export const subscription = pgTable("Subscription", {
	cancelAtPeriodEnd: boolean("cancelAtPeriodEnd"),
	createdAt: timestamp("createdAt", { mode: "date", precision: 3 }).notNull().defaultNow(),
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
		cachedTokens: integer("cachedTokens"),
		// Cost (Decimal(10, 6))
		cost: numeric("cost", { precision: 10, scale: 6 }),
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		// Flexible JSON fields
		inputData: jsonb("inputData"),
		inputTokens: integer("inputTokens"),
		metadata: jsonb("metadata"),
		// Model used
		model: text("model"),
		name: text("name").notNull(),
		outputTokens: integer("outputTokens"),
		// AI output
		reasoning: text("reasoning"),
		reasoningTokens: integer("reasoningTokens"),
		result: text("result"),
		timeToCompletionMs: integer("timeToCompletionMs"),
		timeToFirstTokenMs: integer("timeToFirstTokenMs"),
		timestamp: timestamp("timestamp", { mode: "date", precision: 3, withTimezone: true })
			.notNull()
			.defaultNow(),
		totalTokens: integer("totalTokens"),
		userId: text("userId")
			.notNull()
			.references(() => user.id),
	},
	(table) => [
		index("UsageEvent_userId_timestamp_idx").on(table.userId, table.timestamp),
		index("UsageEvent_name_timestamp_idx").on(table.name, table.timestamp),
	],
);

export const contextTransfer = pgTable(
	"ContextTransfer",
	{
		// Versioned envelope (version byte + IV + AES-GCM ciphertext), base64url.
		// The decryption key never reaches the server; rows are deleted on consume.
		ciphertext: text("ciphertext").notNull(),
		createdAt: timestamp("createdAt", { mode: "date", precision: 3, withTimezone: true })
			.notNull()
			.defaultNow(),
		expiresAt: timestamp("expiresAt", { mode: "date", precision: 3, withTimezone: true }).notNull(),
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		targetPath: text("targetPath").notNull(),
		tokenHash: text("tokenHash").notNull().unique(),
		// User allowed to consume the transfer (currently also the creator).
		userId: text("userId")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
	},
	(table) => [
		index("ContextTransfer_expiresAt_idx").on(table.expiresAt),
		index("ContextTransfer_userId_idx").on(table.userId),
	],
);

export const textSnippet = pgTable(
	"TextSnippet",
	{
		createdAt: timestamp("createdAt", { mode: "date", precision: 3 }).notNull().defaultNow(),
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
	(table) => [uniqueIndex("TextSnippet_userId_key_key").on(table.userId, table.key)],
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

export const templateCollectionTemplate = pgTable(
	"TemplateCollectionTemplate",
	{
		collectionId: text("collectionId")
			.notNull()
			.references(() => templateCollection.id, { onDelete: "cascade" }),
		templateId: text("templateId")
			.notNull()
			.references(() => template.id, { onDelete: "cascade" }),
	},
	(table) => [
		primaryKey({ columns: [table.collectionId, table.templateId] }),
		index("TemplateCollectionTemplate_templateId_idx").on(table.templateId),
	],
);

// ============ AI PROVIDER TABLES ============

export const aiProvider = pgTable("AiProvider", {
	apiKey: text("apiKey"),
	baseUrl: text("baseUrl"),
	id: text("id")
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	name: text("name").notNull(),
	// "openai-compatible" | "openrouter" | "openai" | "anthropic"
	protocol: text("protocol").notNull(),
});

export const aiModel = pgTable(
	"AiModel",
	{
		displayName: text("displayName").notNull(),
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		modelId: text("modelId").notNull(),
		providerId: text("providerId")
			.notNull()
			.references(() => aiProvider.id, { onDelete: "cascade" }),
		supportedParameters: text("supportedParameters").array().notNull().default([]),
		supportsReasoning: boolean("supportsReasoning").notNull().default(false),
	},
	(table) => [uniqueIndex("AiModel_providerId_modelId_key").on(table.providerId, table.modelId)],
);

export const aiDefaults = pgTable("AiDefaults", {
	defaultEvaluationModel: text("defaultEvaluationModel").references(() => aiModel.id, {
		onDelete: "set null",
	}),
	defaultEvaluationReasoningEffort: text("defaultEvaluationReasoningEffort")
		.notNull()
		.default("none"),
	defaultEvaluationTemperature: real("defaultEvaluationTemperature"),
	defaultFileImageMode: text("defaultFileImageMode").notNull().default("multimodal"),
	defaultFileImageModelId: text("defaultFileImageModelId").references(() => aiModel.id, {
		onDelete: "set null",
	}),
	defaultFileImageReasoningEffort: text("defaultFileImageReasoningEffort")
		.notNull()
		.default("none"),
	defaultFileImageTemperature: real("defaultFileImageTemperature"),
	defaultSpeechToTextMode: text("defaultSpeechToTextMode").notNull().default("direct"),
	defaultSpeechToTextModelId: text("defaultSpeechToTextModelId").references(() => aiModel.id, {
		onDelete: "set null",
	}),
	defaultSpeechToTextReasoningEffort: text("defaultSpeechToTextReasoningEffort")
		.notNull()
		.default("none"),
	defaultSpeechToTextTemperature: real("defaultSpeechToTextTemperature"),
	defaultStandardSupportsAudio: boolean("defaultStandardSupportsAudio").notNull().default(false),
	defaultStandardSupportsDocuments: boolean("defaultStandardSupportsDocuments")
		.notNull()
		.default(false),
	defaultTextModelId: text("defaultTextModelId").references(() => aiModel.id, {
		onDelete: "set null",
	}),
	defaultTextReasoningEffort: text("defaultTextReasoningEffort").notNull().default("none"),
	defaultTextTemperature: real("defaultTextTemperature"),
	id: text("id")
		.primaryKey()
		.$defaultFn(() => "global"),
	updatedAt: timestamp("updatedAt", { mode: "date", precision: 3 })
		.notNull()
		.$onUpdate(() => new Date()),
});

export const aiScribeFormConfig = pgTable(
	"AiScribeFormConfig",
	{
		authorId: text("authorId").references(() => user.id, {
			onDelete: "cascade",
		}),
		createdAt: timestamp("createdAt", { mode: "date", precision: 3 }).notNull().defaultNow(),
		description: text("description"),
		enabled: boolean("enabled").notNull().default(true),
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		inputPreset: text("inputPreset").notNull(),
		maxTokens: integer("maxTokens"),
		name: text("name").notNull(),
		promptHarness: text("promptHarness").notNull(),
		slug: text("slug").notNull(),
		temperature: numeric("temperature", { precision: 3, scale: 2 }),
		templateId: text("templateId").references(() => template.id, {
			onDelete: "set null",
		}),
		thinkingBudget: integer("thinkingBudget"),
		updatedAt: timestamp("updatedAt", { mode: "date", precision: 3 })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
		visibility: text("visibility").notNull().default("public"),
	},
	(table) => [
		uniqueIndex("AiScribeFormConfig_slug_key").on(table.slug),
		index("AiScribeFormConfig_authorId_idx").on(table.authorId),
		index("AiScribeFormConfig_authorId_visibility_idx").on(table.authorId, table.visibility),
		index("AiScribeFormConfig_enabled_idx").on(table.enabled),
		index("AiScribeFormConfig_visibility_idx").on(table.visibility),
	],
);

// ============ RELATIONS ============

export const userRelations = relations(user, ({ many }) => ({
	accounts: many(account),
	aiScribeFormConfigs: many(aiScribeFormConfig),
	documentTemplates: many(documentTemplate),
	favourites: many(favourites),
	sessions: many(session),
	subscriptions: many(subscription),
	templateCollections: many(templateCollection),
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
	collectionTemplates: many(templateCollectionTemplate),
	favouriteOf: many(favourites),
}));

export const documentTemplateRelations = relations(documentTemplate, ({ one }) => ({
	author: one(user, {
		fields: [documentTemplate.authorId],
		references: [user.id],
	}),
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

export const templateCollectionRelations = relations(templateCollection, ({ one, many }) => ({
	templates: many(templateCollectionTemplate),
	user: one(user, {
		fields: [templateCollection.userId],
		references: [user.id],
	}),
}));

export const templateCollectionTemplateRelations = relations(
	templateCollectionTemplate,
	({ one }) => ({
		collection: one(templateCollection, {
			fields: [templateCollectionTemplate.collectionId],
			references: [templateCollection.id],
		}),
		template: one(template, {
			fields: [templateCollectionTemplate.templateId],
			references: [template.id],
		}),
	}),
);

export const aiProviderRelations = relations(aiProvider, ({ many }) => ({
	models: many(aiModel),
}));

export const aiModelRelations = relations(aiModel, ({ one }) => ({
	provider: one(aiProvider, {
		fields: [aiModel.providerId],
		references: [aiProvider.id],
	}),
}));

export const aiScribeFormConfigRelations = relations(aiScribeFormConfig, ({ one }) => ({
	author: one(user, {
		fields: [aiScribeFormConfig.authorId],
		references: [user.id],
	}),
	template: one(template, {
		fields: [aiScribeFormConfig.templateId],
		references: [template.id],
	}),
}));
