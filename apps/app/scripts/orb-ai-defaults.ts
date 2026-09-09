import type { Database } from "@repo/database";
import { aiDefaults, aiModel, aiProvider } from "@repo/database/schema";
import { and, eq, isNull } from "drizzle-orm";

import { encryptApiKey } from "../lib/encryption-core";

/** Personal credentials are applied after snapshot activation, never during setup. */
export const configureOrbAiDefaults = async (db: Database): Promise<void> => {
	if (process.env.AMP_ORB !== "1" || process.env.NODE_ENV !== "development") {
		throw new Error("Orb AI defaults require a development orb.");
	}
	const apiKey = [process.env.OPENROUTER_API_KEY, process.env.openrouter_api_key]
		.map((value) => value?.trim())
		.find((value) => value && value !== "orb-placeholder");
	if (!apiKey) {
		console.log("No OpenRouter key available; skipping orb AI defaults.");
		return;
	}
	const encryptedKey = await encryptApiKey(apiKey, process.env.BETTER_AUTH_SECRET ?? "");
	await db.transaction(async (tx) => {
		const [existing] = await tx
			.select({ id: aiProvider.id })
			.from(aiProvider)
			.where(eq(aiProvider.protocol, "openrouter"))
			.limit(1);
		const providerId = existing?.id ?? "orb-openrouter";
		await tx
			.insert(aiProvider)
			.values({
				apiKey: encryptedKey,
				baseUrl: "https://openrouter.ai/api/v1",
				id: providerId,
				name: "OpenRouter",
				protocol: "openrouter",
			})
			.onConflictDoUpdate({ set: { apiKey: encryptedKey }, target: aiProvider.id });
		const [model] = await tx
			.insert(aiModel)
			.values({
				displayName: "Gemini 3.8 Flash",
				modelId: "google/gemini-3.8-flash",
				providerId,
				supportedParameters: [
					"include_reasoning",
					"max_tokens",
					"reasoning",
					"reasoning_effort",
					"response_format",
					"seed",
					"stop",
					"structured_outputs",
					"temperature",
					"tool_choice",
					"tools",
					"top_p",
				],
				supportsReasoning: true,
			})
			.onConflictDoUpdate({
				set: { modelId: "google/gemini-3.8-flash" },
				target: [aiModel.providerId, aiModel.modelId],
			})
			.returning({ id: aiModel.id });
		// Also repair the empty global row created by the app before configuration.
		const defaults = {
			defaultAgentModelId: model.id,
			defaultAgentSupportsAudio: true,
			defaultAgentSupportsDocuments: true,
			defaultFileImageModelId: model.id,
			defaultSpeechToTextModelId: model.id,
			defaultStandardSupportsAgent: true,
			defaultStandardSupportsAudio: true,
			defaultStandardSupportsDocuments: true,
			defaultTextModelId: model.id,
			id: "global",
		};
		await tx
			.insert(aiDefaults)
			.values(defaults)
			.onConflictDoUpdate({
				set: defaults,
				setWhere: and(
					isNull(aiDefaults.defaultTextModelId),
					isNull(aiDefaults.defaultAgentModelId),
					isNull(aiDefaults.defaultFileImageModelId),
					isNull(aiDefaults.defaultSpeechToTextModelId),
				),
				target: aiDefaults.id,
			});
	});
	console.log("Orb OpenRouter provider and Gemini 3.8 Flash defaults are ready.");
};

if (import.meta.main) {
	const { database } = await import("@repo/database/client");
	try {
		await configureOrbAiDefaults(database);
	} catch {
		console.error("Orb AI configuration failed; check database connectivity and the auth secret.");
		process.exitCode = 1;
	} finally {
		await database.$client.end({ timeout: 5 });
	}
}
