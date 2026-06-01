import { ORPCError, type } from "@orpc/server";
import { usageEvent } from "@repo/database";
import { generateText, Output } from "ai";
import { z } from "zod";

import {
	FILL_INPUT_PAYLOAD_LIMITS,
	formatPayloadBytes,
	getBase64DecodedByteLength,
} from "@/lib/input-fill-limits";
import { buildUsageEventData, extractOpenRouterUsage } from "@/lib/usage-logging";
import type { StandardUsage, UsageInputData, UsageMetadata } from "@/lib/usage-logging";
import { AI_INPUT_FILL_EVENT_NAME } from "@/lib/usage-event-names";
import { USER_MESSAGES } from "@/lib/user-messages";
import { authed } from "@/orpc";
import { scribeEntitlementsMiddleware } from "@/orpc/middlewares/entitlements";
import {
	buildProviderOptions,
	resolveGenerationStrategy,
} from "@/orpc/scribe/providers";
import type { FillInputsInputPayload, InputField } from "@/orpc/scribe/types";
import {
	formatAudioTranscriptsForPrompt,
	prepareAudioInputForModel,
} from "./audio-input";
import { createContextFileParts, extractContextFileText } from "./context-file-input";
import { fillInputsConfig } from "./fill-inputs-config";
import { enforceScribeUsageLimit } from "./usage-limit";

type FieldValue = boolean | number | string;
type FillInputsResult = { fieldValues: Record<string, FieldValue> };

interface FillInputAudioPayloadSummary {
	index: number;
	mediaType: string;
	payloadBytes: number;
	wavFallbackBytes: number;
	totalBytes: number;
}

interface FillInputContextFilePayloadSummary {
	index: number;
	mediaType: string;
	name: string;
	payloadBytes: number;
	size: number;
}

interface FillInputPayloadSummary {
	audioFiles: FillInputAudioPayloadSummary[];
	contextFiles: FillInputContextFilePayloadSummary[];
	inputFieldCount: number;
	textContextCharacters: number;
	totalPayloadBytes: number;
}

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

const throwPayloadLimitError = (message: string): never => {
	throw new ORPCError("BAD_REQUEST", { message });
};

const assertAtMost = (value: number, limit: number, message: string) => {
	if (value > limit) {
		throwPayloadLimitError(message);
	}
};

const getTextContextCharacterCount = (
	textContext: FillInputsInputPayload["textContext"],
): number => {
	if (!textContext) {
		return 0;
	}

	let total = 0;
	for (const value of Object.values(textContext)) {
		total += value?.length ?? 0;
	}
	return total;
};

const summarizeAndValidatePayload = (
	input: FillInputsInputPayload,
): FillInputPayloadSummary => {
	const audioFiles = input.audioFiles ?? [];
	const contextFiles = input.contextFiles ?? [];
	const textContextCharacters = getTextContextCharacterCount(input.textContext);

	assertAtMost(
		input.inputFields.length,
		FILL_INPUT_PAYLOAD_LIMITS.maxInputFields,
		`Maximal ${FILL_INPUT_PAYLOAD_LIMITS.maxInputFields} Eingabefelder können automatisch gefüllt werden.`,
	);
	assertAtMost(
		audioFiles.length,
		FILL_INPUT_PAYLOAD_LIMITS.maxAudioFiles,
		`Maximal ${FILL_INPUT_PAYLOAD_LIMITS.maxAudioFiles} Audioaufnahmen können berücksichtigt werden.`,
	);
	assertAtMost(
		contextFiles.length,
		FILL_INPUT_PAYLOAD_LIMITS.maxContextFiles,
		`Maximal ${FILL_INPUT_PAYLOAD_LIMITS.maxContextFiles} Dateien können berücksichtigt werden.`,
	);
	assertAtMost(
		textContextCharacters,
		FILL_INPUT_PAYLOAD_LIMITS.maxTextContextCharacters,
		`Der Textkontext ist zu lang. Maximal erlaubt sind ${FILL_INPUT_PAYLOAD_LIMITS.maxTextContextCharacters.toLocaleString("de-DE")} Zeichen.`,
	);

	for (const field of input.inputFields) {
		assertAtMost(
			field.label.length,
			FILL_INPUT_PAYLOAD_LIMITS.maxInputFieldLabelCharacters,
			`Das Eingabefeld "${field.label.slice(0, 40)}" hat ein zu langes Label.`,
		);
		assertAtMost(
			field.description?.length ?? 0,
			FILL_INPUT_PAYLOAD_LIMITS.maxInputFieldDescriptionCharacters,
			`Die Beschreibung für "${field.label}" ist zu lang.`,
		);
	}

	let totalPayloadBytes = 0;
	const audioSummaries: FillInputAudioPayloadSummary[] = [];
	for (const [index, audioFile] of audioFiles.entries()) {
		const payloadBytes = getBase64DecodedByteLength(audioFile.data);
		const wavFallbackBytes = getBase64DecodedByteLength(
			audioFile.wavFallback?.data,
		);
		const totalBytes = payloadBytes + wavFallbackBytes;
		totalPayloadBytes += totalBytes;

		assertAtMost(
			totalBytes,
			FILL_INPUT_PAYLOAD_LIMITS.maxAudioPayloadBytesPerRecording,
			`Audioaufnahme ${index + 1} ist zu groß. Maximal erlaubt sind ${formatPayloadBytes(FILL_INPUT_PAYLOAD_LIMITS.maxAudioPayloadBytesPerRecording)} pro Aufnahme.`,
		);

		audioSummaries.push({
			index: index + 1,
			mediaType: audioFile.mimeType,
			payloadBytes,
			totalBytes,
			wavFallbackBytes,
		});
	}
	assertAtMost(
		audioSummaries.reduce((sum, file) => sum + file.totalBytes, 0),
		FILL_INPUT_PAYLOAD_LIMITS.maxAudioPayloadBytesTotal,
		`Die Audioaufnahmen sind zusammen zu groß. Maximal erlaubt sind ${formatPayloadBytes(FILL_INPUT_PAYLOAD_LIMITS.maxAudioPayloadBytesTotal)}.`,
	);

	const fileSummaries: FillInputContextFilePayloadSummary[] = [];
	for (const [index, file] of contextFiles.entries()) {
		const payloadBytes = getBase64DecodedByteLength(file.data);
		totalPayloadBytes += payloadBytes;
		assertAtMost(
			payloadBytes,
			FILL_INPUT_PAYLOAD_LIMITS.maxContextFileBytes,
			`Die Datei "${file.name}" ist zu groß. Maximal erlaubt sind ${formatPayloadBytes(FILL_INPUT_PAYLOAD_LIMITS.maxContextFileBytes)} pro Datei.`,
		);
		fileSummaries.push({
			index: index + 1,
			mediaType: file.mimeType,
			name: file.name,
			payloadBytes,
			size: file.size,
		});
	}
	assertAtMost(
		fileSummaries.reduce((sum, file) => sum + file.payloadBytes, 0),
		FILL_INPUT_PAYLOAD_LIMITS.maxContextFilesTotalBytes,
		`Die Dateien sind zusammen zu groß. Maximal erlaubt sind ${formatPayloadBytes(FILL_INPUT_PAYLOAD_LIMITS.maxContextFilesTotalBytes)}.`,
	);

	return {
		audioFiles: audioSummaries,
		contextFiles: fileSummaries,
		inputFieldCount: input.inputFields.length,
		textContextCharacters,
		totalPayloadBytes,
	};
};

const summarizeInputFields = (inputFields: InputField[]) =>
	inputFields.map((field) => ({
		hasDescription: Boolean(field.description?.trim()),
		label: field.label,
		optionCount: field.options?.length ?? 0,
		type: field.type ?? "string",
		unit: field.unit,
	}));

const buildFillInputUsageInputData = (
	input: FillInputsInputPayload,
	payloadSummary: FillInputPayloadSummary,
): UsageInputData => ({
	audioFiles: payloadSummary.audioFiles,
	contextFiles: payloadSummary.contextFiles,
	inputFields: summarizeInputFields(input.inputFields),
	textContext: input.textContext,
});

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
	.use(scribeEntitlementsMiddleware)
	.input(type<FillInputsInputPayload>())
	.handler(async ({ input, context }) => {
		const audioFiles = input.audioFiles ?? [];
		const contextFiles = input.contextFiles ?? [];
		const hasAudio = audioFiles.length > 0;
		const hasFiles = contextFiles.length > 0;
		const hasText = hasTextContext(input);
		const payloadSummary = summarizeAndValidatePayload(input);

		const { entitlements } = await enforceScribeUsageLimit({
			db: context.db,
			entitlements: context.entitlements.scribe,
			session: context.session,
		});

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

		const generationStrategy = await resolveGenerationStrategy(context.db, {
			hasAudio,
			hasFiles,
		}).catch((error: unknown) => {
			const message =
				error instanceof Error ? error.message : USER_MESSAGES.unknownError;
			throw new ORPCError("BAD_REQUEST", { message });
		});

		const generationSelection = generationStrategy.generation;
		const audioSelection =
			generationStrategy.mode === "direct"
				? generationStrategy.generation
				: generationStrategy.speechToText;
		const preparedAudio = await prepareAudioInputForModel({
			audioFiles,
			mode: generationStrategy.mode === "direct" ? "native" : "transcription",
			resolvedModel: audioSelection?.model ?? generationSelection.model,
		}).catch((error: unknown) => {
			const message =
				error instanceof Error ? error.message : USER_MESSAGES.unknownError;
			throw new ORPCError("BAD_REQUEST", { message });
		});
		const fileTextContext =
			generationStrategy.mode === "preprocess" && hasFiles
				? await extractContextFileText({
						contextFiles,
						modelSelection:
							generationStrategy.fileImage ?? generationSelection,
						userId: context.session.user.id,
						zdr: entitlements.hasActiveSubscription,
					})
				: "";
		const messages = fillInputsConfig.prompt({
			audioTranscripts: formatAudioTranscriptsForPrompt(
				preparedAudio.transcripts,
			),
			contextFiles:
				generationStrategy.mode === "direct" ? contextFiles : undefined,
			fileTextContext,
			textContext: input.textContext,
		});

		const outputSchema = createFillInputsSchema(input.inputFields);
		const hasNativeAudioParts = preparedAudio.contentParts.length > 0;
		const nativeContextFiles =
			generationStrategy.mode === "direct" ? contextFiles : [];

		const userContent =
			hasNativeAudioParts || nativeContextFiles.length > 0
				? [
						{ text: messages[1]?.content ?? "", type: "text" as const },
						...preparedAudio.contentParts,
						...createContextFileParts(nativeContextFiles),
					]
				: messages[1]?.content ?? "";

		const result = await generateText({
			maxOutputTokens: fillInputsConfig.modelConfig.maxTokens,
			messages: [
				{ content: messages[0]?.content ?? "", role: "system" },
				{ content: userContent, role: "user" },
			],
			model: generationSelection.model.model,
			output: Output.object({
				description: "Suggested field values for the requested input fields.",
				name: "FillInputsResult",
				schema: outputSchema,
			}),
			providerOptions: buildProviderOptions({
				includeUsage: true,
				model: generationSelection.model,
				reasoningEffort: generationSelection.reasoningEffort,
				userId: context.session.user.id,
				zdr: entitlements.hasActiveSubscription,
			}),
			temperature: fillInputsConfig.modelConfig.temperature,
		}).catch((error: unknown) => {
			const details =
				error instanceof Error ? error.message : USER_MESSAGES.unknownError;
			throw new ORPCError("BAD_REQUEST", {
				message: `Ausfüllen fehlgeschlagen. (${details})`,
			});
		});

		const fillResult = toFillInputsResult(result.output, outputSchema);
		const openRouterUsage = generationSelection.model.isOpenRouter
			? extractOpenRouterUsage(
					(result as { providerMetadata?: Record<string, unknown> }).providerMetadata,
				)
			: undefined;
		const usageMetadata: UsageMetadata = {
			endpoint: "input_fill",
			generationStrategy: {
				mode: generationStrategy.mode,
				usedNativeAudio: preparedAudio.contentParts.length > 0,
				usedTranscription: preparedAudio.transcripts.length > 0,
				usedFilePreprocessing: Boolean(fileTextContext),
			},
			modelConfig: {
				maxTokens: fillInputsConfig.modelConfig.maxTokens,
				reasoningEffort: generationSelection.reasoningEffort,
				temperature: fillInputsConfig.modelConfig.temperature,
			},
			payloadSummary,
			preprocessing: {
				fileImageModel:
					generationStrategy.mode === "preprocess"
						? generationStrategy.fileImage?.model.modelName
						: undefined,
				speechToTextModel:
					generationStrategy.mode === "preprocess"
						? generationStrategy.speechToText?.model.modelName
						: undefined,
			},
			promptName: fillInputsConfig.promptName,
			promptSource: "local",
			zdrEnabled: entitlements.hasActiveSubscription,
		};

		await context.db.insert(usageEvent).values(
			buildUsageEventData({
				inputData: entitlements.hasActiveSubscription
					? undefined
					: buildFillInputUsageInputData(input, payloadSummary),
				metadata: usageMetadata,
				model: generationSelection.model.modelName,
				name: AI_INPUT_FILL_EVENT_NAME,
				openRouterUsage,
				result: entitlements.hasActiveSubscription
					? "[zdr - content redacted]"
					: JSON.stringify(fillResult.fieldValues),
				standardUsage: result.usage as StandardUsage,
				userId: context.session.user.id,
			}),
		);

		return fillResult;
	});
