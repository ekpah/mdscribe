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
	real,
	text,
	timestamp,
	uniqueIndex,
} from "drizzle-orm/pg-core";

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
	// Non-normalized username (casing preserved) from the better-auth username plugin.
	displayUsername: text("displayUsername"),
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
	// Normalized (lowercase) unique handle from the better-auth username plugin.
	username: text("username").notNull().unique(),
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
		examples: text("examples").array().notNull().default([]),
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		information: text("information").notNull().default(""),
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
		information: text("information").notNull().default(""),
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
		traceId: text("traceId"),
		userId: text("userId")
			.notNull()
			.references(() => user.id),
	},
	(table) => [
		index("UsageEvent_userId_timestamp_idx").on(table.userId, table.timestamp),
		index("UsageEvent_name_timestamp_idx").on(table.name, table.timestamp),
		index("UsageEvent_traceId_timestamp_idx").on(table.traceId, table.timestamp),
	],
);

export const usageTrace = pgTable(
	"UsageTrace",
	{
		endedAt: timestamp("endedAt", { mode: "date", precision: 3, withTimezone: true }),
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		metadata: jsonb("metadata"),
		name: text("name").notNull(),
		startedAt: timestamp("startedAt", { mode: "date", precision: 3, withTimezone: true })
			.notNull()
			.defaultNow(),
		status: text("status").notNull(),
		userId: text("userId")
			.notNull()
			.references(() => user.id),
	},
	(table) => [index("UsageTrace_userId_startedAt_idx").on(table.userId, table.startedAt)],
);

export const usageObservation = pgTable(
	"UsageObservation",
	{
		endedAt: timestamp("endedAt", { mode: "date", precision: 3, withTimezone: true }),
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		inputData: jsonb("inputData"),
		metadata: jsonb("metadata"),
		name: text("name").notNull(),
		outputData: jsonb("outputData"),
		parentObservationId: text("parentObservationId"),
		sequence: integer("sequence").notNull(),
		startedAt: timestamp("startedAt", { mode: "date", precision: 3, withTimezone: true })
			.notNull()
			.defaultNow(),
		status: text("status").notNull(),
		traceId: text("traceId")
			.notNull()
			.references(() => usageTrace.id, { onDelete: "cascade" }),
		type: text("type").notNull(),
		usageEventId: text("usageEventId"),
	},
	(table) => [
		index("UsageObservation_traceId_sequence_idx").on(table.traceId, table.sequence),
		index("UsageObservation_usageEventId_idx").on(table.usageEventId),
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
	byokEnabled: boolean("byokEnabled").notNull().default(false),
	id: text("id")
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	name: text("name").notNull(),
	// "openai-compatible" | "openrouter" | "openai" | "anthropic"
	protocol: text("protocol").notNull(),
});

export const userAiProvider = pgTable(
	"UserAiProvider",
	{
		apiKey: text("apiKey").notNull(),
		createdAt: timestamp("createdAt", { mode: "date", precision: 3, withTimezone: true })
			.notNull()
			.defaultNow(),
		enabled: boolean("enabled").notNull().default(false),
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		name: text("name").notNull(),
		providerId: text("providerId")
			.notNull()
			.references(() => aiProvider.id, { onDelete: "cascade" }),
		updatedAt: timestamp("updatedAt", { mode: "date", precision: 3, withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
		userId: text("userId")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		validatedAt: timestamp("validatedAt", {
			mode: "date",
			precision: 3,
			withTimezone: true,
		}).notNull(),
	},
	(table) => [
		uniqueIndex("UserAiProvider_userId_providerId_key").on(table.userId, table.providerId),
		index("UserAiProvider_userId_idx").on(table.userId),
		index("UserAiProvider_providerId_idx").on(table.providerId),
	],
);

export const aiModel = pgTable(
	"AiModel",
	{
		displayName: text("displayName").notNull(),
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		modelId: text("modelId").notNull(),
		openRouterRoutingMode: text("openRouterRoutingMode").notNull().default("default"),
		providerId: text("providerId")
			.notNull()
			.references(() => aiProvider.id, { onDelete: "cascade" }),
		supportedParameters: text("supportedParameters").array().notNull().default([]),
		supportsReasoning: boolean("supportsReasoning").notNull().default(false),
	},
	(table) => [uniqueIndex("AiModel_providerId_modelId_key").on(table.providerId, table.modelId)],
);

export const aiDefaults = pgTable("AiDefaults", {
	defaultAgentModelId: text("defaultAgentModelId").references(() => aiModel.id, {
		onDelete: "set null",
	}),
	defaultAgentReasoningEffort: text("defaultAgentReasoningEffort").notNull().default("none"),
	defaultAgentSupportsAudio: boolean("defaultAgentSupportsAudio").notNull().default(false),
	defaultAgentSupportsDocuments: boolean("defaultAgentSupportsDocuments").notNull().default(false),
	defaultAgentTemperature: real("defaultAgentTemperature"),
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
	defaultStandardSupportsAgent: boolean("defaultStandardSupportsAgent").notNull().default(false),
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
		// Slugs are unique per namespace: global (author-less) entries share one
		// namespace; user-owned entries are unique per author.
		uniqueIndex("AiScribeFormConfig_global_slug_key")
			.on(table.slug)
			.where(sql`${table.authorId} is null`),
		uniqueIndex("AiScribeFormConfig_author_slug_key")
			.on(table.authorId, table.slug)
			.where(sql`${table.authorId} is not null`),
		index("AiScribeFormConfig_authorId_idx").on(table.authorId),
		index("AiScribeFormConfig_authorId_visibility_idx").on(table.authorId, table.visibility),
		index("AiScribeFormConfig_enabled_idx").on(table.enabled),
		index("AiScribeFormConfig_visibility_idx").on(table.visibility),
	],
);

/**
 * A composed documentation editor ("Brief-Baukasten" in the UI). Each section
 * of the letter references the AI form (`AiScribeFormConfig`) that generates it.
 * One column per prompt-harness section (diagnosis, anamnese, epikrise); befunde
 * stays on the default for now and gets its own column later.
 */
export const aiScribeWorkspace = pgTable(
	"AiScribeWorkspace",
	{
		anamneseFormId: text("anamneseFormId").references(() => aiScribeFormConfig.id, {
			onDelete: "set null",
		}),
		authorId: text("authorId").references(() => user.id, {
			onDelete: "cascade",
		}),
		createdAt: timestamp("createdAt", { mode: "date", precision: 3 }).notNull().defaultNow(),
		description: text("description"),
		diagnosisFormId: text("diagnosisFormId").references(() => aiScribeFormConfig.id, {
			onDelete: "set null",
		}),
		enabled: boolean("enabled").notNull().default(true),
		epikriseFormId: text("epikriseFormId").references(() => aiScribeFormConfig.id, {
			onDelete: "set null",
		}),
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		name: text("name").notNull(),
		slug: text("slug").notNull(),
		updatedAt: timestamp("updatedAt", { mode: "date", precision: 3 })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
		visibility: text("visibility").notNull().default("public"),
	},
	(table) => [
		uniqueIndex("AiScribeWorkspace_global_slug_key")
			.on(table.slug)
			.where(sql`${table.authorId} is null`),
		uniqueIndex("AiScribeWorkspace_author_slug_key")
			.on(table.authorId, table.slug)
			.where(sql`${table.authorId} is not null`),
		index("AiScribeWorkspace_authorId_idx").on(table.authorId),
		index("AiScribeWorkspace_enabled_idx").on(table.enabled),
		index("AiScribeWorkspace_visibility_idx").on(table.visibility),
	],
);

// ============ RELATIONS ============

export const userRelations = relations(user, ({ many }) => ({
	accounts: many(account),
	aiProviders: many(userAiProvider),
	aiScribeFormConfigs: many(aiScribeFormConfig),
	aiScribeWorkspaces: many(aiScribeWorkspace),
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

export const usageTraceRelations = relations(usageTrace, ({ one, many }) => ({
	observations: many(usageObservation),
	user: one(user, { fields: [usageTrace.userId], references: [user.id] }),
}));

export const usageObservationRelations = relations(usageObservation, ({ one }) => ({
	trace: one(usageTrace, { fields: [usageObservation.traceId], references: [usageTrace.id] }),
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
	userCredentials: many(userAiProvider),
}));

export const userAiProviderRelations = relations(userAiProvider, ({ one }) => ({
	provider: one(aiProvider, {
		fields: [userAiProvider.providerId],
		references: [aiProvider.id],
	}),
	user: one(user, {
		fields: [userAiProvider.userId],
		references: [user.id],
	}),
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

export const aiScribeWorkspaceRelations = relations(aiScribeWorkspace, ({ one }) => ({
	author: one(user, {
		fields: [aiScribeWorkspace.authorId],
		references: [user.id],
	}),
}));
