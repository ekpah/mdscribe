import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

import type {
	account,
	favourites,
	session,
	subscription,
	template,
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
export type Subscription = InferSelectModel<typeof subscription>;
export type UsageEvent = InferSelectModel<typeof usageEvent>;
export type TextSnippet = InferSelectModel<typeof textSnippet>;
export type Favourite = InferSelectModel<typeof favourites>;

// Insert types (for creating records)
export type NewUser = InferInsertModel<typeof user>;
export type NewAccount = InferInsertModel<typeof account>;
export type NewSession = InferInsertModel<typeof session>;
export type NewVerification = InferInsertModel<typeof verification>;
export type NewTemplate = InferInsertModel<typeof template>;
export type NewSubscription = InferInsertModel<typeof subscription>;
export type NewUsageEvent = InferInsertModel<typeof usageEvent>;
export type NewTextSnippet = InferInsertModel<typeof textSnippet>;
export type NewFavourite = InferInsertModel<typeof favourites>;
