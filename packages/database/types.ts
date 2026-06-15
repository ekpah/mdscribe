import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

import type {
	account,
	aiDefaults,
	aiScribeFormConfig,
	aiModel,
	aiProvider,
	contextTransfer,
	aiScribeWorkspace,
	documentTemplate,
	favourites,
	session,
	subscription,
	template,
	templateCollection,
	templateCollectionTemplate,
	textSnippet,
	usageEvent,
	user,
	verification,
} from "./schema";

// Select types (for reading from DB) - matches Prisma's generated types
export type User = InferSelectModel<typeof user>;
export type Account = InferSelectModel<typeof account>;
export type Session = InferSelectModel<typeof session>;
export type Verification = InferSelectModel<typeof verification>;
export type Template = InferSelectModel<typeof template>;
export type DocumentTemplate = InferSelectModel<typeof documentTemplate>;
export type TemplateCollection = InferSelectModel<typeof templateCollection>;
export type TemplateCollectionTemplate = InferSelectModel<
	typeof templateCollectionTemplate
>;
export type Subscription = InferSelectModel<typeof subscription>;
export type UsageEvent = InferSelectModel<typeof usageEvent>;
export type ContextTransfer = InferSelectModel<typeof contextTransfer>;
export type TextSnippet = InferSelectModel<typeof textSnippet>;
export type Favourite = InferSelectModel<typeof favourites>;

// Insert types (for creating records)
export type NewUser = InferInsertModel<typeof user>;
export type NewAccount = InferInsertModel<typeof account>;
export type NewSession = InferInsertModel<typeof session>;
export type NewVerification = InferInsertModel<typeof verification>;
export type NewTemplate = InferInsertModel<typeof template>;
export type NewDocumentTemplate = InferInsertModel<typeof documentTemplate>;
export type NewTemplateCollection = InferInsertModel<typeof templateCollection>;
export type NewTemplateCollectionTemplate = InferInsertModel<
	typeof templateCollectionTemplate
>;
export type NewSubscription = InferInsertModel<typeof subscription>;
export type NewUsageEvent = InferInsertModel<typeof usageEvent>;
export type NewContextTransfer = InferInsertModel<typeof contextTransfer>;
export type NewTextSnippet = InferInsertModel<typeof textSnippet>;
export type NewFavourite = InferInsertModel<typeof favourites>;

// AI Provider types
export type AiProvider = InferSelectModel<typeof aiProvider>;
export type AiModel = InferSelectModel<typeof aiModel>;
export type AiDefaults = InferSelectModel<typeof aiDefaults>;
export type AiScribeFormConfig = InferSelectModel<typeof aiScribeFormConfig>;
export type NewAiProvider = InferInsertModel<typeof aiProvider>;
export type NewAiModel = InferInsertModel<typeof aiModel>;
export type NewAiDefaults = InferInsertModel<typeof aiDefaults>;
export type NewAiScribeFormConfig = InferInsertModel<typeof aiScribeFormConfig>;
export type AiScribeWorkspace = InferSelectModel<
	typeof aiScribeWorkspace
>;
export type NewAiScribeWorkspace = InferInsertModel<
	typeof aiScribeWorkspace
>;
