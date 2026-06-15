import { eq } from "drizzle-orm";
import { database } from "./client";
import { user } from "./schema";

/**
 * One-off backfill for the better-auth username plugin.
 *
 * Derives a meaningful, unique `username` (normalized, lowercase) and
 * `displayUsername` (casing preserved) for every existing user that has none.
 * Source of truth is the email local-part, falling back to the name, then
 * "user"; collisions get a numeric suffix. Idempotent: skips users that already
 * have a username. Does NOT touch `name` (the person's display name).
 *
 * Run with: `bun run backfill:usernames` (in packages/database).
 */

const MIN_LENGTH = 3;
const MAX_LENGTH = 30;
// Leave room for a numeric collision suffix.
const BASE_MAX_LENGTH = MAX_LENGTH - 4;

const INVALID_CHARS = /[^a-zA-Z0-9._]/g;
const REPEATED_DOTS = /\.{2,}/g;
const EDGE_SEPARATORS = /^[._]+|[._]+$/g;
const WHITESPACE = /\s+/g;

const sanitize = (value: string): string =>
	value
		.normalize("NFKD")
		.replaceAll(WHITESPACE, ".")
		.replaceAll(INVALID_CHARS, "")
		.replaceAll(REPEATED_DOTS, ".")
		.replaceAll(EDGE_SEPARATORS, "")
		.slice(0, BASE_MAX_LENGTH);

/** Build a case-preserved base handle from email local-part, then name. */
const deriveBase = (email: string, name: string | null): string => {
	const localPart = email.split("@")[0] ?? "";
	let base = sanitize(localPart);
	if (base.length < MIN_LENGTH && name) {
		base = sanitize(name);
	}
	if (base.length < MIN_LENGTH) {
		base = "user";
	}
	while (base.length < MIN_LENGTH) {
		base = `${base}0`;
	}
	return base;
};

const backfillUsernames = async (): Promise<void> => {
	const users = await database
		.select({
			email: user.email,
			id: user.id,
			name: user.name,
			username: user.username,
		})
		.from(user);

	// Track taken normalized usernames to dedupe in-memory before writing.
	const taken = new Set<string>();
	for (const row of users) {
		if (row.username) {
			taken.add(row.username.toLowerCase());
		}
	}

	let updated = 0;
	for (const row of users) {
		if (row.username) {
			continue;
		}

		const base = deriveBase(row.email, row.name);
		let display = base;
		let normalized = base.toLowerCase();
		let suffix = 1;
		while (taken.has(normalized)) {
			suffix += 1;
			display = `${base}${suffix}`;
			normalized = `${base.toLowerCase()}${suffix}`;
		}
		taken.add(normalized);

		await database
			.update(user)
			.set({ displayUsername: display, username: normalized })
			.where(eq(user.id, row.id));
		updated += 1;
		console.log(`${row.email} -> @${normalized}`);
	}

	console.log(`Backfilled ${updated} username(s) (${users.length} users total).`);
};

try {
	await backfillUsernames();
} catch (error) {
	console.error("Username backfill failed:", error);
	process.exit(1);
} finally {
	await database.$client.end({ timeout: 5 });
}
