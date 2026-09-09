import { afterEach, beforeEach, expect, test } from "bun:test";

import type { Database } from "@repo/database";
import { aiDefaults, aiModel, aiProvider } from "@repo/database/schema";

import { configureOrbAiDefaults } from "../../scripts/orb-ai-defaults";
import { startTestServer } from "../setup";

const variables = [
	"AMP_ORB",
	"NODE_ENV",
	"OPENROUTER_API_KEY",
	"openrouter_api_key",
	"BETTER_AUTH_SECRET",
];
let saved: (string | undefined)[];
beforeEach(() => {
	saved = variables.map((name) => process.env[name]);
	process.env.AMP_ORB = "1";
	Reflect.set(process.env, "NODE_ENV", "development");
	process.env.OPENROUTER_API_KEY = "orb-placeholder";
	process.env.openrouter_api_key = "test-lowercase-key";
	process.env.BETTER_AUTH_SECRET = "test-secret";
});
afterEach(() => {
	for (const [index, name] of variables.entries()) {
		if (saved[index] === undefined) {
			Reflect.deleteProperty(process.env, name);
		} else {
			process.env[name] = saved[index];
		}
	}
});

test("requires a development orb", async () => {
	Reflect.set(process.env, "NODE_ENV", "production");
	await expect(configureOrbAiDefaults({} as Database)).rejects.toThrow("development orb");
});

test("repairs empty defaults, reuses providers, and preserves later admin choices", async () => {
	const { db, close } = await startTestServer("orb-ai-defaults");
	const rollback = new Error("rollback test data");
	try {
		await db.transaction(async (tx) => {
			await tx.delete(aiDefaults);
			await tx.delete(aiModel);
			await tx.delete(aiProvider);
			await tx
				.insert(aiProvider)
				.values({ id: "existing", name: "OpenRouter", protocol: "openrouter" });
			await tx.insert(aiDefaults).values({ id: "global" });
			await configureOrbAiDefaults(tx as unknown as Database);
			const [provider] = await tx.select().from(aiProvider);
			expect(provider.id).toBe("existing");
			expect(provider.apiKey).not.toContain("test-lowercase-key");
			const [model] = await tx.select().from(aiModel);
			expect(model.modelId).toBe("google/gemini-3.8-flash");
			const [defaults] = await tx.select().from(aiDefaults);
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
			});
			await tx.update(aiDefaults).set({ defaultStandardSupportsAudio: false });
			await configureOrbAiDefaults(tx as unknown as Database);
			expect(await tx.select().from(aiProvider)).toHaveLength(1);
			expect(await tx.select().from(aiModel)).toHaveLength(1);
			const [preserved] = await tx.select().from(aiDefaults);
			expect(preserved.defaultStandardSupportsAudio).toBe(false);
			// Missing credentials must leave the configuration untouched.
			delete process.env.openrouter_api_key;
			await configureOrbAiDefaults({} as Database);
			throw rollback;
		});
	} catch (error) {
		if (error !== rollback) {
			throw error;
		}
	} finally {
		await close();
	}
});
