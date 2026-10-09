import { afterEach, beforeEach, expect, test } from "bun:test";

import type { Database } from "@repo/database";
import { aiDefaults, aiModel, aiProvider, template, user } from "@repo/database/schema";

import { env } from "@/env";
import { decrypt } from "@/lib/encryption";

import { seedDatabase } from "../../scripts/seed";
import { startTestServer } from "../setup";

// OCR providers (local PaddleOCR, Mistral OCR, Privatemode) are covered separately.
const isPaddle = ({ id }: { id: string }) => id.startsWith("dev-paddleocr-");
const isOcrRow = ({ id, providerId }: { id: string; providerId?: string }) =>
	/^dev-paddleocr-|-ocr$/.test(providerId ?? id);
const selectProviders = async (db: Database) => {
	const rows = await db.select().from(aiProvider);
	return rows.filter((row) => !isOcrRow(row));
};
const selectModels = async (db: Database) => {
	const rows = await db.select().from(aiModel);
	return rows.filter((row) => !isOcrRow(row));
};

const providerVariables = [
	"OPENROUTER_API_KEY",
	"ANTHROPIC_API_KEY",
	"OPENAI_API_KEY",
	"MISTRAL_API_KEY",
	"TINFOIL_API_KEY",
];
const ocrVariables = ["PRIVATEMODE_API_KEY"];
const variables = [
	...providerVariables,
	...ocrVariables,
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
	const providers = await selectProviders(db);
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
	const [model] = await selectModels(db);
	expect(model.modelId).toBe("google/gemini-3.8-flash");
	// Keys for OCR-capable providers also make their OCR models selectable.
	const allModels = await db.select().from(aiModel);
	expect(allModels.filter(isOcrRow).map(({ modelId }) => modelId)).toEqual([
		"mistral-ocr-4-0",
		"ocr",
	]);
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
	expect(await selectProviders(db)).toHaveLength(5);
	expect(await selectModels(db)).toHaveLength(1);
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
	expect(await selectProviders(db)).toHaveLength(0);
	delete process.env.MDSCRIBE_SKIP_AI_SEED;
	await seedDatabase(db);
	const [openai] = await selectProviders(db);
	expect(openai.name).toBe("OpenAI");
	expect(await decrypt(openai.apiKey ?? "")).toBe("lowercase-openai");
	expect(await selectModels(db)).toHaveLength(0);
	expect(await db.select().from(aiDefaults)).toHaveLength(0);
	await db
		.insert(aiProvider)
		.values({ id: "existing-openrouter", name: "OpenRouter", protocol: "openrouter" });
	await db.insert(aiDefaults).values({ id: "global" });
	process.env.openrouter_api_key = "lowercase-openrouter";
	seedState.seeded = false;
	await seedDatabase(db);
	expect(await selectProviders(db)).toHaveLength(2);
	const [model] = await selectModels(db);
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
	expect(await selectProviders(db)).toHaveLength(0);
	process.env.OPENAI_API_KEY = "test-openai";
	await expect(seedDatabase(db)).rejects.toThrow("BETTER_AUTH_SECRET");
	expect(await selectProviders(db)).toHaveLength(0);
});

test("makes local PaddleOCR selectable without making it a default", async () => {
	const { db } = await startTestServer("database-seed-paddle");
	process.env.MDSCRIBE_SKIP_AI_SEED = "1";
	await seedDatabase(db);
	seedState.seeded = false;
	await seedDatabase(db);
	delete process.env.MDSCRIBE_SKIP_AI_SEED;
	const providers = await db.select().from(aiProvider);
	expect(providers.filter(isPaddle).map(({ baseUrl, protocol }) => [protocol, baseUrl])).toEqual([
		["ocr-http", "http://127.0.0.1:8829/ocr"],
	]);
	const models = await db.select().from(aiModel);
	expect(models.filter(isPaddle)).toHaveLength(1);
	expect(await db.select().from(aiDefaults)).toHaveLength(0);
});
