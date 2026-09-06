import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

import { aiProvider } from "@repo/database/schema";

import { env } from "@/env";
import { decrypt, encrypt } from "@/lib/encryption";

import { seedDatabase } from "../../scripts/seed";

const variables = [
	"OPENROUTER_API_KEY",
	"ANTHROPIC_API_KEY",
	"OPENAI_API_KEY",
	"MISTRAL_API_KEY",
	"TINFOIL_API_KEY",
	"BETTER_AUTH_SECRET",
	"NODE_ENV",
	"MDSCRIBE_ALLOW_DEV_SEED",
];
const seedState = globalThis as unknown as { seeded?: boolean };
let saved: Record<string, string | undefined>;
let previousSeeded: boolean | undefined;

beforeEach(() => {
	saved = Object.fromEntries(variables.map((name) => [name, process.env[name]]));
	previousSeeded = seedState.seeded;
	seedState.seeded = false;
	for (const name of variables) {
		Reflect.deleteProperty(process.env, name);
	}
	Reflect.set(process.env, "NODE_ENV", "development");
	process.env.MDSCRIBE_ALLOW_DEV_SEED = "1";
	process.env.BETTER_AUTH_SECRET = env.BETTER_AUTH_SECRET;
});

afterEach(() => {
	for (const name of variables) {
		if (saved[name] === undefined) {
			Reflect.deleteProperty(process.env, name);
		} else {
			process.env[name] = saved[name];
		}
	}
	seedState.seeded = previousSeeded;
});

const database = (userCount = 0) => {
	const providers: (typeof aiProvider.$inferInsert)[] = [];
	const transaction = mock(async (runTransaction: (tx: unknown) => Promise<void>) => {
		await runTransaction({
			insert: (table: unknown) => ({
				values: (value: typeof aiProvider.$inferInsert) => {
					if (table === aiProvider) {
						providers.push(value);
					}
					return Promise.resolve();
				},
			}),
		});
	});
	return {
		db: {
			select: () => ({
				from: () => ({
					limit: () => Promise.resolve(userCount > 0 ? [{ id: "existing-user" }] : []),
				}),
			}),
			transaction,
		} as unknown as Parameters<typeof seedDatabase>[0],
		providers,
		transaction,
	};
};

describe("development AI provider seed", () => {
	test("seeds all five services with app-decryptable keys and default URLs", async () => {
		for (const name of variables.slice(0, 5)) {
			process.env[name] = `  test-${name}  `;
		}
		const { db, providers } = database();
		await seedDatabase(db);
		expect(providers.map(({ name, protocol, baseUrl }) => [name, protocol, baseUrl])).toEqual([
			["OpenRouter", "openrouter", "https://openrouter.ai/api/v1"],
			["Anthropic", "anthropic", "https://api.anthropic.com/v1"],
			["OpenAI", "openai", "https://api.openai.com/v1"],
			["Mistral", "openai-compatible", "https://api.mistral.ai/v1"],
			["Tinfoil", "tinfoil", "https://inference.tinfoil.sh/v1"],
		]);
		for (const [index, provider] of providers.entries()) {
			expect(await decrypt(provider.apiKey ?? "")).toBe(`test-${variables[index]}`);
			expect(provider.apiKey).not.toContain(`test-${variables[index]}`);
		}
		await seedDatabase(db);
		expect(providers).toHaveLength(5);
	});

	test("skips missing, blank, and placeholder keys", async () => {
		process.env.OPENROUTER_API_KEY = "orb-placeholder";
		process.env.ANTHROPIC_API_KEY = "  ";
		delete process.env.BETTER_AUTH_SECRET;
		const { db, providers } = database();
		await seedDatabase(db);
		expect(providers).toHaveLength(0);
	});

	test("does not seed an existing database", async () => {
		process.env.OPENAI_API_KEY = "test-openai";
		const { db, transaction } = database(1);
		await seedDatabase(db);
		expect(transaction).not.toHaveBeenCalled();
	});

	test("requires explicit development opt-in", async () => {
		const { db, transaction } = database();
		delete process.env.MDSCRIBE_ALLOW_DEV_SEED;
		await seedDatabase(db);
		expect(transaction).not.toHaveBeenCalled();
		process.env.MDSCRIBE_ALLOW_DEV_SEED = "1";
		Reflect.set(process.env, "NODE_ENV", "production");
		await expect(seedDatabase(db)).rejects.toThrow("NODE_ENV=development");
		expect(transaction).not.toHaveBeenCalled();
	});

	test("refuses to encrypt without an auth secret", async () => {
		process.env.OPENAI_API_KEY = "test-openai";
		delete process.env.BETTER_AUTH_SECRET;
		await expect(seedDatabase(database().db)).rejects.toThrow("BETTER_AUTH_SECRET");
		expect(seedState.seeded).toBe(false);
	});

	test("app encryption still round-trips with fresh random IVs", async () => {
		const first = await encrypt("test-key");
		const second = await encrypt("test-key");
		expect(first).not.toBe(second);
		expect(await decrypt(first)).toBe("test-key");
		expect(await decrypt(second)).toBe("test-key");
	});
});
