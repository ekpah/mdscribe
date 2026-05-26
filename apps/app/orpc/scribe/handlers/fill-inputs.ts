import { ORPCError, type } from "@orpc/server";
import { generateText, Output } from "ai";
import { z } from "zod";

import { USER_MESSAGES } from "@/lib/user-messages";
import { authed } from "@/orpc";
import { resolveModel } from "@/orpc/scribe/providers";
import type { FillInputsInputPayload, InputField } from "@/orpc/scribe/types";
import { getAudioMediaType } from "./audio-media-type";
import { fillInputsConfig } from "./fill-inputs-config";

type FieldValue = boolean | number | string;
type FillInputsResult = { fieldValues: Record<string, FieldValue> };

const describeField = (field: InputField) =>
	[
		field.description,
		field.type ? `type=${field.type}` : undefined,
		field.options?.length ? `options=${field.options.join(", ")}` : undefined,
		field.unit ? `unit=${field.unit}` : undefined,
		'Return "" when no matching source information exists.',
	]
		.filter(Boolean)
		.join(" | ");

const getFieldValueSchema = (field: InputField) => {
	const description = describeField(field);
	if (field.type === "number") {
		return z.union([z.number(), z.string()]).meta({ description });
	}
	if (field.type === "boolean") {
		return z.union([z.boolean(), z.string()]).meta({ description });
	}
	return z.string().meta({ description });
};

const createFillInputsSchema = (inputFields: InputField[]) => {
	const fieldValuesShape: Record<string, z.ZodTypeAny> = {};
	for (const field of inputFields) {
		fieldValuesShape[field.label] = getFieldValueSchema(field);
	}

	return z.object({
		fieldValues: z.object(fieldValuesShape).strict(),
	}).strict();
};

const toFillInputsResult = (
	object: unknown,
	schema: ReturnType<typeof createFillInputsSchema>,
): FillInputsResult => {
	const parsed = schema.safeParse(object);
	if (parsed.success) {
		return parsed.data as FillInputsResult;
	}
	return {
		fieldValues: object as Record<string, boolean | number | string>,
	};
};

const hasTextContext = (input: FillInputsInputPayload) =>
	Boolean(
		input.textContext &&
			Object.values(input.textContext).some((value) => value?.trim()),
	);

/**
 * Simple MVP autofill handler.
 *
 * Input:
 * - inputFields: compact list of fields the model should fill
 * - audioFiles/textContext/contextFiles: source material
 *
 * Output:
 * - { fieldValues: { [fieldLabel]: value } }
 */
export const fillInputsHandler = authed
	.input(type<FillInputsInputPayload>())
	.handler(async ({ input, context }) => {
		const audioFiles = input.audioFiles ?? [];
		const contextFiles = input.contextFiles ?? [];
		const hasAudio = audioFiles.length > 0;
		const hasFiles = contextFiles.length > 0;
		const hasText = hasTextContext(input);

		if (input.inputFields.length === 0) {
			throw new ORPCError("BAD_REQUEST", {
				message: "Keine Eingabefelder zum Ausfüllen verfügbar.",
			});
		}

		if (!(hasAudio || hasFiles || hasText)) {
			throw new ORPCError("BAD_REQUEST", {
				message: "Bitte Audio aufnehmen, Textkontext eingeben oder Dateien hinzufügen.",
			});
		}

		const resolved = await resolveModel(context.db, {
			requireAudio: hasAudio,
		}).catch((error: unknown) => {
			const message =
				error instanceof Error ? error.message : USER_MESSAGES.unknownError;
			throw new ORPCError("BAD_REQUEST", { message });
		});

		const messages = fillInputsConfig.prompt({
			contextFiles,
			textContext: input.textContext,
		});

		const outputSchema = createFillInputsSchema(input.inputFields);

		const userContent =
			hasAudio || hasFiles
				? [
						{ text: messages[1]?.content ?? "", type: "text" as const },
						...audioFiles.map((file) => ({
							data: Buffer.from(file.data, "base64"),
							mediaType: getAudioMediaType(file.mimeType, resolved.isOpenRouter),
							type: "file" as const,
						})),
						...contextFiles.map((file) => ({
							data: Buffer.from(file.data, "base64"),
							mediaType: file.mimeType,
							type: "file" as const,
						})),
					]
				: messages[1]?.content ?? "";

		const result = await generateText({
			maxOutputTokens: fillInputsConfig.modelConfig.maxTokens,
			messages: [
				{ content: messages[0]?.content ?? "", role: "system" },
				{ content: userContent, role: "user" },
			],
			model: resolved.model,
			output: Output.object({
				description: "Suggested field values for the requested input fields.",
				name: "FillInputsResult",
				schema: outputSchema,
			}),
			temperature: fillInputsConfig.modelConfig.temperature,
		}).catch((error: unknown) => {
			const details =
				error instanceof Error ? error.message : USER_MESSAGES.unknownError;
			throw new ORPCError("BAD_REQUEST", {
				message: `Ausfüllen fehlgeschlagen. (${details})`,
			});
		});

		return toFillInputsResult(result.output, outputSchema);
	});
