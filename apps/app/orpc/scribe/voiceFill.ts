import { type } from "@orpc/server";
import { usageEvent } from "@repo/database";
import type { InputTagType } from "@repo/markdoc-md/parse/parseMarkdocToInputs";
import { generateObject } from "ai";
import { z } from "zod";
import {
	buildUsageEventData,
	extractOpenRouterUsage,
} from "@/lib/usage-logging";
import { authed } from "@/orpc";
import { resolveModel } from "./providers";
import type { InputField, VoiceFillInputPayload } from "./types";
import { voiceFillConfig } from './voiceFillConfig';
import type { VoiceFillFieldDefinition } from './voiceFillConfig';

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

const deriveFieldsFromTags = (
	inputTags: InputTagType[],
): VoiceFillFieldDefinition[] => {
	const fields: VoiceFillFieldDefinition[] = [];
	const seen = new Set<string>();

	const pushField = (field: VoiceFillFieldDefinition) => {
		if (!field.label || seen.has(field.label)) {return;}
		fields.push(field);
		seen.add(field.label);
	};

	const visit = (input: unknown) => {
		// Guard against non-object inputs (e.g., strings, nulls)
		if (!input || typeof input !== "object") {return;}
		const tag = input as Record<string, unknown>;
		const name = tag.name as string | undefined;
		const attributes = tag.attributes as Record<string, unknown> | undefined;
		const children = tag.children as unknown[] | undefined;

		if (name === "Info" && attributes?.primary) {
			pushField({
				description: attributes.description as string | undefined,
				label: attributes.primary as string,
				type: (attributes.type as "string" | "number" | "date") ?? "string",
				unit: attributes.unit as string | undefined,
			});
			for (const child of children ?? []) {
				visit(child);
			}
			return;
		}

		if (name === "Switch" && attributes?.primary) {
			const options = (children ?? [])
				.filter((child) => {
					if (!child || typeof child !== "object") {return false;}
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
				options,
				type: "switch",
			});
			for (const child of children ?? []) {
				visit(child);
			}
			return;
		}

		if (name === "Case") {
			for (const child of children ?? []) {
				visit(child);
			}
			return;
		}

		if (name === "Score") {
			for (const child of children ?? []) {
				visit(child);
			}
		}
	};

	for (const inputTag of inputTags) {
		visit(inputTag);
	}

	return fields;
};

const normalizeInputFields = (
	inputFields: InputField[] | undefined,
): VoiceFillFieldDefinition[] =>
	(inputFields ?? []).map((field) => ({
		description: field.description,
		label: field.label,
	}));

/**
 * Voice fill handler - fills generic inputs from audio input using AI
 *
 * Takes input fields and audio files, returns filled field values.
 * Uses the admin-configured speech-to-text default model.
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

		// Resolve the admin-configured speech-to-text model
		const resolved = await resolveModel(context.db, {
			requireAudio: true,
		});

		// Build prompt from config
		const promptMessages = config.prompt({ fields, inputTagsJson });

		// Build messages with audio content
		// Config returns [system, user] messages - user message contains field labels
		const messages = [
			{
				content: promptMessages[0].content,
				role: "system" as const,
			},
			{
				content: [
					// Include field labels text from config
					{ text: promptMessages[1].content, type: "text" as const },
					// Append audio files
					...audioFiles.map((af) => ({
						data: Buffer.from(af.data, "base64"),
						mediaType: af.mimeType,
						type: "file" as const,
					})),
				],
				role: "user" as const,
			},
		];

		const result = await generateObject({
			experimental_telemetry: { isEnabled: true },
			messages,
			model: resolved.model,
			schema: voiceFillSchema,
			temperature: config.modelConfig.temperature ?? 0.3,
		});

		const { object, usage } = result;
		const normalized = normalizeVoiceFillObject(object);

		// Extract usage data (graceful fallback for non-OpenRouter providers)
		const openrouterUsage = resolved.isOpenRouter
			? extractOpenRouterUsage(
					(result as { providerMetadata?: Record<string, unknown> })
						.providerMetadata,
				)
			: undefined;

		// Log usage event
		await context.db.insert(usageEvent).values(
			buildUsageEventData({
				inputData: {
					audioCount: audioFiles.length,
					fieldCount: fields.length,
				},
				metadata: {
					promptName: config.promptName,
					promptSource: "local",
				},
				model: resolved.modelName,
				name: "ai_input_voice_fill",
				openRouterUsage: openrouterUsage ?? null,
				standardUsage: usage
					? {
							inputTokens: (usage as { promptTokens?: number }).promptTokens,
							outputTokens: (usage as { completionTokens?: number })
								.completionTokens,
							totalTokens: (usage as { totalTokens?: number }).totalTokens,
						}
					: undefined,
				userId: context.session.user.id,
			}),
		);

		return normalized;
	});
