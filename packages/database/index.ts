import "server-only";

// Re-export useful Drizzle utilities
export {
	and,
	asc,
	avg,
	count,
	desc,
	eq,
	gt,
	gte,
	inArray,
	isNotNull,
	isNull,
	like,
	lt,
	lte,
	ne,
	notInArray,
	or,
	sql,
	sum,
} from "drizzle-orm";
// Export only the database type here to avoid eager database bootstrap.
export type { Database } from "./client";
// Re-export schema tables for direct access
export * from "./schema";

// Re-export types for backward compatibility
export * from "./types";
