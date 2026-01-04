import "server-only";

// Re-export the database client
export { database, type Database } from "./client";

// Re-export schema tables for direct access
export * from "./schema";

// Re-export types for backward compatibility
export * from "./types";

// Re-export useful Drizzle utilities
export { and, eq, gt, gte, lt, lte, ne, or, sql, inArray, notInArray, isNull, isNotNull, desc, asc, count, sum, avg, like } from "drizzle-orm";
