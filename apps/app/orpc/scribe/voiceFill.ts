import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { type } from "@orpc/server";
import { usageEvent } from "@repo/database";
import { env } from "@repo/env";
import { generateObject } from "ai";
import { z } from "zod";
import { buildUsageEventData } from "@/lib/usage-logging";
import { authed } from "@/orpc";
import type { AudioFile, InputField, VoiceFillInputPayload } from "./types";
import {
	voiceFillConfig,
	type VoiceFillFieldDefinition,
} from "./voiceFillConfig";
import type { InputTagType } from "@repo/markdoc-md/parse/parseMarkdocToInputs";

/**
 * Schema for voice fill response
 */
const voiceFillSchema = z.object({
	fieldValues: z.record(z.string(), z.string()),
});

function normalizeVoiceFillObject(
	object: unknown,
): z.infer<typeof voiceFillSchema> {
	const parsed = voiceFillSchema.safeParse(object);
	if (parsed.success) {
		return parsed.data;
	}

	if (object && typeof object === "object" && !("fieldValues" in object)) {
		const record = object as Record<string, unknown>;
		const allStrings = Object.values(record).every(
			(value) => typeof value === "string",
		);
		if (allStrings) {
			return { fieldValues: record as Record<string, string> };
		}
	}

	throw new Error("Invalid voice fill response format");
}

const openrouter = createOpenRouter({
	apiKey: env.OPENROUTER_API_KEY as string,
});

const deriveFieldsFromTags = (
	inputTags: InputTagType[],
): VoiceFillFieldDefinition[] => {
	const fields: VoiceFillFieldDefinition[] = [];
	const seen = new Set<string>();

	const pushField = (field: VoiceFillFieldDefinition) => {
		if (!field.label || seen.has(field.label)) return;
		fields.push(field);
		seen.add(field.label);
	};

	const visit = (input: unknown) => {
		// Guard against non-object inputs (e.g., strings, nulls)
		if (!input || typeof input !== "object") return;
		const tag = input as Record<string, unknown>;
		const name = tag.name as string | undefined;
		const attributes = tag.attributes as Record<string, unknown> | undefined;
		const children = tag.children as unknown[] | undefined;

		if (name === "Info" && attributes?.primary) {
			pushField({
				label: attributes.primary as string,
				description: attributes.description as string | undefined,
				type: (attributes.type as "string" | "number" | "date") ?? "string",
				unit: attributes.unit as string | undefined,
			});
			children?.forEach(visit);
			return;
		}

		if (name === "Switch" && attributes?.primary) {
			const options = (children ?? [])
				.filter((child) => {
					if (!child || typeof child !== "object") return false;
					const c = child as Record<string, unknown>;
					return (
						c.name === "Case" &&
						(c.attributes as Record<string, unknown>)?.primary
					);
				})
				.map((child) => {
					const c = child as Record<string, unknown>;
					return (c.attributes as Record<string, unknown>).primary as string;
				});
			pushField({
				label: attributes.primary as string,
				type: "switch",
				options,
			});
			children?.forEach(visit);
			return;
		}

		if (name === "Case") {
			children?.forEach(visit);
			return;
		}

		if (name === "Score") {
			children?.forEach(visit);
		}
	};

	inputTags.forEach(visit);

	return fields;
};

const normalizeInputFields = (
	inputFields: InputField[] | undefined,
): VoiceFillFieldDefinition[] =>
	(inputFields ?? []).map((field) => ({
		label: field.label,
		description: field.description,
	}));

/**
 * Voice fill handler - fills generic inputs from audio input using AI
 *
 * Takes input fields and audio files, returns filled field values
 * Uses Gemini 3 Flash for audio processing and field extraction
 */
export const voiceFillHandler = authed
	.input(type<VoiceFillInputPayload>())
	.handler(async ({ input, context }) => {
		const { inputFields, inputTags, audioFiles } = input;
		const config = voiceFillConfig;

		if (!inputTags?.length && !inputFields?.length) {
			throw new Error("No input tags or fields provided");
		}

		const fields = inputTags?.length
			? deriveFieldsFromTags(inputTags)
			: normalizeInputFields(inputFields);
		const inputTagsJson = inputTags?.length
			? JSON.stringify(inputTags, null, 2)
			: undefined;

		// Build prompt from config
		const promptMessages = config.prompt({ fields, inputTagsJson });

		const modelName = "google/gemini-3-flash-preview";
		const model = openrouter(modelName);

		// Build messages with audio content
		// Config returns [system, user] messages - user message contains field labels
		const messages = [
			{
				role: "system" as const,
				content: promptMessages[0].content,
			},
			{
				role: "user" as const,
				content: [
					// Include field labels text from config
					{ type: "text" as const, text: promptMessages[1].content },
					// Append audio files
					...audioFiles.map((af) => ({
						type: "file" as const,
						data: Buffer.from(af.data, "base64"),
						mediaType: af.mimeType,
					})),
				],
			},
		];

		const result = await generateObject({
			model,
			messages,
			schema: voiceFillSchema,
			temperature: config.modelConfig.temperature ?? 0.3,
			experimental_telemetry: { isEnabled: true },
		});

		const { object, usage } = result;
		const normalized = normalizeVoiceFillObject(object);

		// Extract OpenRouter usage if available from provider metadata
		const providerMetadata = (
			result as { providerMetadata?: Record<string, unknown> }
		).providerMetadata;
		const openrouterUsage = (
			providerMetadata?.openrouter as {
				usage?: {
					promptTokens?: number;
					completionTokens?: number;
					totalTokens?: number;
					cost?: number;
				};
			}
		)?.usage;

		// Log usage event
		await context.db.insert(usageEvent).values(
			buildUsageEventData({
				userId: context.session.user.id,
				name: "ai_input_voice_fill",
				model: modelName,
				openRouterUsage: openrouterUsage
					? {
							promptTokens: openrouterUsage.promptTokens ?? 0,
							completionTokens: openrouterUsage.completionTokens ?? 0,
							totalTokens: openrouterUsage.totalTokens ?? 0,
							cost: openrouterUsage.cost,
						}
					: null,
				standardUsage: usage
					? {
							inputTokens: (usage as { promptTokens?: number }).promptTokens,
							outputTokens: (usage as { completionTokens?: number })
								.completionTokens,
							totalTokens: (usage as { totalTokens?: number }).totalTokens,
						}
					: undefined,
				inputData: {
					fieldCount: fields.length,
					audioCount: audioFiles.length,
				},
				metadata: {
					promptName: config.promptName,
					promptSource: "local",
				},
			}),
		);

		return normalized;
	});
