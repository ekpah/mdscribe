import { afterEach, beforeEach, expect, test } from "bun:test";

import type { Database } from "@repo/database";
import { aiDefaults, aiModel, aiProvider, template, user } from "@repo/database/schema";

import { env } from "@/env";
import { decrypt } from "@/lib/encryption";

import { seedDatabase } from "../../scripts/seed";
import { startTestServer } from "../setup";

const providerVariables = [
	"OPENROUTER_API_KEY",
	"ANTHROPIC_API_KEY",
	"OPENAI_API_KEY",
	"MISTRAL_API_KEY",
	"TINFOIL_API_KEY",
];
const variables = [
	...providerVariables,
	...providerVariables.map((name) => name.toLowerCase()),
	"NODE_ENV",
	"BETTER_AUTH_SECRET",
	"MDSCRIBE_ALLOW_DEV_SEED",
	"MDSCRIBE_SKIP_AI_SEED",
];
const seedState = globalThis as unknown as { seeded?: boolean };
let saved: (string | undefined)[];
let previousSeeded: boolean | undefined;
beforeEach(() => {
	saved = variables.map((name) => process.env[name]);
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
	for (const [index, name] of variables.entries()) {
		if (saved[index] === undefined) {
			Reflect.deleteProperty(process.env, name);
		} else {
			process.env[name] = saved[index];
		}
	}
	seedState.seeded = previousSeeded;
});

test("requires explicit development opt-in", async () => {
	delete process.env.MDSCRIBE_ALLOW_DEV_SEED;
	await seedDatabase({} as Database);
	process.env.MDSCRIBE_ALLOW_DEV_SEED = "1";
	Reflect.set(process.env, "NODE_ENV", "production");
	await expect(seedDatabase({} as Database)).rejects.toThrow("NODE_ENV=development");
});

test("seeds all available providers, Gemini defaults, and preserves admin choices on repeat", async () => {
	const { db } = await startTestServer("database-seed");
	for (const variable of providerVariables) {
		process.env[variable] = ` test-${variable} `;
	}
	await seedDatabase(db);
	const providers = await db.select().from(aiProvider);
	expect(providers.map(({ name, protocol, baseUrl }) => [name, protocol, baseUrl])).toEqual([
		["OpenRouter", "openrouter", "https://openrouter.ai/api/v1"],
		["Anthropic", "anthropic", "https://api.anthropic.com/v1"],
		["OpenAI", "openai", "https://api.openai.com/v1"],
		["Mistral", "openai-compatible", "https://api.mistral.ai/v1"],
		["Tinfoil", "tinfoil", "https://inference.tinfoil.sh/v1"],
	]);
	for (const [index, provider] of providers.entries()) {
		expect(await decrypt(provider.apiKey ?? "")).toBe(`test-${providerVariables[index]}`);
	}
	const [model] = await db.select().from(aiModel);
	expect(model.modelId).toBe("google/gemini-3.8-flash");
	const [defaults] = await db.select().from(aiDefaults);
	expect(defaults).toMatchObject({
		defaultAgentModelId: model.id,
		defaultAgentSupportsAudio: true,
		defaultAgentSupportsDocuments: true,
		defaultFileImageModelId: model.id,
		defaultSpeechToTextModelId: model.id,
		defaultStandardSupportsAgent: true,
		defaultStandardSupportsAudio: true,
		defaultStandardSupportsDocuments: true,
		defaultTextModelId: model.id,
		defaultTextReasoningEffort: "minimal",
	});
	await db
		.update(aiDefaults)
		.set({ defaultStandardSupportsAudio: false, defaultTextReasoningEffort: "high" });
	await seedDatabase(db);
	expect(await db.select().from(aiProvider)).toHaveLength(5);
	expect(await db.select().from(aiModel)).toHaveLength(1);
	expect(await db.select().from(user)).toHaveLength(1);
	expect(await db.select().from(template)).toHaveLength(5);
	const [preserved] = await db.select().from(aiDefaults);
	expect(preserved.defaultStandardSupportsAudio).toBe(false);
	expect(preserved.defaultTextReasoningEffort).toBe("high");
});

test("skips absent keys and adds providers after snapshot/user seeding", async () => {
	const { db } = await startTestServer("database-seed-activation");
	process.env.OPENROUTER_API_KEY = "orb-placeholder";
	process.env.ANTHROPIC_API_KEY = " ";
	process.env.openai_api_key = "lowercase-openai";
	process.env.MDSCRIBE_SKIP_AI_SEED = "1";
	await seedDatabase(db);
	expect(await db.select().from(aiProvider)).toHaveLength(0);
	delete process.env.MDSCRIBE_SKIP_AI_SEED;
	await seedDatabase(db);
	const [openai] = await db.select().from(aiProvider);
	expect(openai.name).toBe("OpenAI");
	expect(await decrypt(openai.apiKey ?? "")).toBe("lowercase-openai");
	expect(await db.select().from(aiModel)).toHaveLength(0);
	expect(await db.select().from(aiDefaults)).toHaveLength(0);
	await db
		.insert(aiProvider)
		.values({ id: "existing-openrouter", name: "OpenRouter", protocol: "openrouter" });
	await db.insert(aiDefaults).values({ id: "global" });
	process.env.openrouter_api_key = "lowercase-openrouter";
	seedState.seeded = false;
	await seedDatabase(db);
	expect(await db.select().from(aiProvider)).toHaveLength(2);
	const [model] = await db.select().from(aiModel);
	expect(model.providerId).toBe("existing-openrouter");
	const [defaults] = await db.select().from(aiDefaults);
	expect(defaults.defaultTextModelId).toBe(model.id);
	expect(defaults.defaultStandardSupportsAgent).toBe(true);
	expect(await db.select().from(user)).toHaveLength(1);
});

test("no credentials needs no encryption secret, but a provided key does", async () => {
	const { db } = await startTestServer("database-seed-secret");
	delete process.env.BETTER_AUTH_SECRET;
	await seedDatabase(db);
	expect(await db.select().from(aiProvider)).toHaveLength(0);
	process.env.OPENAI_API_KEY = "test-openai";
	await expect(seedDatabase(db)).rejects.toThrow("BETTER_AUTH_SECRET");
	expect(await db.select().from(aiProvider)).toHaveLength(0);
});
