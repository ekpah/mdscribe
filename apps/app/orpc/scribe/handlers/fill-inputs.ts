import { ORPCError, type } from "@orpc/server";
import { usageEvent } from "@repo/database";
import type { Database } from "@repo/database";
import { extractJsonMiddleware, generateText, Output, wrapLanguageModel } from "ai";
import { createMdscribeSource } from "markdoc-md/citations";
import { z } from "zod";

import {
	FILL_INPUT_PAYLOAD_LIMITS,
	formatPayloadBytes,
	getBase64DecodedByteLength,
	getContextDocumentPayloadByteLength,
} from "@/lib/input-fill-limits";
import { AI_INPUT_FILL_EVENT_NAME } from "@/lib/usage-event-names";
import { buildUsageEventData, extractOpenRouterUsage } from "@/lib/usage-logging";
import type { StandardUsage, UsageInputData, UsageMetadata } from "@/lib/usage-logging";
import { USER_MESSAGES } from "@/lib/user-messages";
import { authed } from "@/orpc";
import { scribeEntitlementsMiddleware } from "@/orpc/middlewares/entitlements";
import { composeScribeContext } from "@/orpc/scribe/context";
import { fillInputsWithDecisions } from "@/orpc/scribe/fill-inputs/decide";
import { supportsDecision } from "@/orpc/scribe/fill-inputs/questions";
import {
	buildFillInputsSourceContext,
	composeFillInputsPrompt,
	FILL_INPUTS_PROMPT_NAME,
} from "@/orpc/scribe/prompts/core/fill-inputs";
import type { FillInputsCitationSource } from "@/orpc/scribe/prompts/core/fill-inputs";
import {
	buildProviderOptions,
	isGenerationStrategyFullyByok,
	resolveDecisionModel,
	resolveGenerationStrategy,
} from "@/orpc/scribe/providers";
import type { DecisionModelSelection, MediaPlan } from "@/orpc/scribe/providers";
import type { FillInputsInputPayload, FillInputsResult, InputField } from "@/orpc/scribe/types";

import {
	formatAudioTranscriptsForPrompt,
	prepareAudioInputForModel,
	transcribeAudioFilesWithPrompt,
} from "./audio-input";
import { createContextFileParts, extractContextFiles } from "./context-file-input";
import { logMediaPreprocessingUsage } from "./preprocessing-usage";
import { enforceScribeUsageLimit } from "./usage-limit";

interface FillInputAudioPayloadSummary {
	index: number;
	mediaType: string;
	payloadBytes: number;
	wavFallbackBytes: number;
	totalBytes: number;
}

interface FillInputContextFilePayloadSummary {
	index: number;
	mediaType?: string;
	name: string;
	payloadBytes: number;
	size?: number;
}

interface FillInputPayloadSummary {
	audioFiles: FillInputAudioPayloadSummary[];
	contextFiles: FillInputContextFilePayloadSummary[];
	inputFieldCount: number;
	templateExampleCount: number;
	templateExamplesCharacters: number;
	templateInformationCharacters: number;
	textContextCharacters: number;
	totalPayloadBytes: number;
}

const getFieldValueSchema = (field: InputField) => {
	if (field.type === "switch" && field.options?.length) {
		return z.enum(field.options);
	}
	if (field.type === "number") {
		return z.union([z.number(), z.string()]);
	}
	if (field.type === "boolean") {
		return z.boolean();
	}
	return z.string();
};

const createFillInputsSchema = (
	inputFields: InputField[],
	citationSources: string[],
	hasAudio: boolean,
) => {
	const fields = new Map(inputFields.map((field) => [field.label, getFieldValueSchema(field)]));
	// One fixed item schema instead of repeating a nested citation schema for
	// every field. Keep field-specific types and source constraints local.
	const citationSchema = z
		.object({
			quote: z.string().refine((quote) => quote.length >= 1 && quote.length <= 4000),
			source: z
				.number()
				.refine(
					(source) => Number.isInteger(source) && source >= 1 && source <= citationSources.length,
				),
		})
		.strict();
	const suggestionSchema = z
		.object({
			citations: z
				.array(citationSchema)
				.refine(
					(citations) =>
						citations.length <= 10 &&
						(hasAudio || citationSources.length === 0 || citations.length >= 1),
				),
			field: z.string().refine((label) => fields.has(label)),
			value: z.union([z.string(), z.number(), z.boolean()]),
		})
		.strict()
		.refine(
			(suggestion) => fields.get(suggestion.field)?.safeParse(suggestion.value).success ?? false,
		);

	return z
		.object({
			suggestions: z
				.array(suggestionSchema)
				.refine(
					(items) =>
						items.length <= fields.size &&
						new Set(items.map((item) => item.field)).size === items.length,
				),
		})
		.strict();
};

const toFillInputsResult = (
	object: unknown,
	schema: ReturnType<typeof createFillInputsSchema>,
	citationSources: string[],
): FillInputsResult => {
	const parsed = schema.safeParse(object);
	if (parsed.success) {
		return {
			ocrResults: [],
			suggestions: Object.fromEntries(
				parsed.data.suggestions.map(({ citations, field, value }) => [
					field,
					{
						...(citations.length
							? {
									citations: citations.map(({ quote, source }) => ({
										quote,
										source: citationSources[source - 1],
									})),
								}
							: {}),
						value,
					},
				]),
			),
		};
	}
	throw new ORPCError("BAD_REQUEST", {
		message:
			"Ausfüllen fehlgeschlagen. (Die Modellantwort entspricht nicht dem erwarteten Schema.)",
	});
};

const stripJsonCodeFence = (text: string): string =>
	text
		.trim()
		.replace(/^```(?:json)?\s*\n?/u, "")
		.replace(/\n?```\s*$/u, "")
		.trim();

const normalizeGeneratedJson = (text: string): string => {
	const normalized = stripJsonCodeFence(text);
	try {
		const parsed = JSON.parse(normalized) as unknown;
		return typeof parsed === "string" ? stripJsonCodeFence(parsed) : normalized;
	} catch {
		return normalized;
	}
};

const getCitationSources = (input: FillInputsInputPayload): FillInputsCitationSource[] => {
	const sources = Object.entries(input.textContext ?? {})
		.filter((entry): entry is [string, string] => Boolean(entry[1]?.trim()))
		.map(([id]) => ({
			label: `Textkontext: ${id}`,
			source: createMdscribeSource("input", id),
		}));
	const seen = new Set(sources.map(({ source }) => source));

	for (const file of input.contextFiles ?? []) {
		const id = file.id?.trim();
		if (!id || id.length > 1024) {
			continue;
		}
		const source = createMdscribeSource("file", id);
		if (seen.has(source)) {
			continue;
		}
		seen.add(source);
		sources.push({ label: `Datei: ${file.name}`, source });
	}

	return sources;
};

/**
 * Reads the structured object from a `generateText` result.
 *
 * `result.output` is a lazy getter that throws `NoOutputGeneratedError` when the
 * model did not finish with reason "stop" (the AI SDK only parses structured
 * output on a clean stop). We fall back to parsing `result.text` so a complete
 * JSON body that merely carried a non-"stop" finish reason still succeeds, and
 * return `null` when nothing usable can be recovered.
 */
const readStructuredOutput = (result: { output?: unknown; text?: string }): unknown => {
	try {
		return result.output;
	} catch {
		const { text } = result;
		if (!text) {
			return null;
		}
		try {
			return JSON.parse(normalizeGeneratedJson(text));
		} catch {
			return null;
		}
	}
};

const hasTextContext = (input: FillInputsInputPayload) =>
	Boolean(input.textContext && Object.values(input.textContext).some((value) => value?.trim()));

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

const summarizeAndValidatePayload = (input: FillInputsInputPayload): FillInputPayloadSummary => {
	const audioFiles = input.audioFiles ?? [];
	const contextFiles = input.contextFiles ?? [];
	const templateExamples = input.templateExamples ?? [];
	const templateExamplesCharacters = templateExamples.reduce(
		(total, example) => total + example.length,
		0,
	);
	const templateInformationCharacters = input.templateInformation?.length ?? 0;
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
		templateExamples.length,
		FILL_INPUT_PAYLOAD_LIMITS.maxTemplateExamples,
		`Maximal ${FILL_INPUT_PAYLOAD_LIMITS.maxTemplateExamples} Vorlagenbeispiele können berücksichtigt werden.`,
	);
	assertAtMost(
		templateExamplesCharacters,
		FILL_INPUT_PAYLOAD_LIMITS.maxTemplateExamplesCharacters,
		`Die Vorlagenbeispiele sind zu lang. Maximal erlaubt sind ${FILL_INPUT_PAYLOAD_LIMITS.maxTemplateExamplesCharacters.toLocaleString("de-DE")} Zeichen.`,
	);
	assertAtMost(
		templateInformationCharacters,
		FILL_INPUT_PAYLOAD_LIMITS.maxTemplateInformationCharacters,
		USER_MESSAGES.templateInformationTooLong,
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
		const wavFallbackBytes = getBase64DecodedByteLength(audioFile.wavFallback?.data);
		const totalBytes = payloadBytes + wavFallbackBytes;
		totalPayloadBytes += totalBytes;

		if (payloadBytes === 0) {
			throwPayloadLimitError(`Audioaufnahme ${index + 1} enthält keine Audiodaten.`);
		}

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
		const payloadBytes = getContextDocumentPayloadByteLength(file);
		totalPayloadBytes += payloadBytes;
		assertAtMost(
			payloadBytes,
			FILL_INPUT_PAYLOAD_LIMITS.maxContextFileBytes,
			`Die Datei "${file.name}" ist zu groß. Maximal erlaubt sind ${formatPayloadBytes(FILL_INPUT_PAYLOAD_LIMITS.maxContextFileBytes)} pro Datei.`,
		);
		fileSummaries.push({
			index: index + 1,
			...(file.kind === "ocr" ? {} : { mediaType: file.mimeType, size: file.size }),
			name: file.name,
			payloadBytes,
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
		templateExampleCount: templateExamples.length,
		templateExamplesCharacters,
		templateInformationCharacters,
		textContextCharacters,
		totalPayloadBytes,
	};
};

const buildFillInputUsageInputData = (
	input: FillInputsInputPayload,
	payloadSummary: FillInputPayloadSummary,
): UsageInputData => ({
	audioFiles: payloadSummary.audioFiles,
	contextFiles: payloadSummary.contextFiles,
	inputFields: input.inputFields,
	templateExampleCount: payloadSummary.templateExampleCount,
	templateExamplesCharacters: payloadSummary.templateExamplesCharacters,
	templateInformationCharacters: payloadSummary.templateInformationCharacters,
	textContext: input.textContext,
});

type FillInputsGenerationStrategy = Awaited<ReturnType<typeof resolveGenerationStrategy>>;
type FillInputsGenerationSelection = FillInputsGenerationStrategy["generation"];
type FillInputsPreparedAudio = Awaited<ReturnType<typeof prepareAudioInputForModel>>;

const assertFillInputsRequest = ({
	hasAudio,
	hasFiles,
	hasText,
	inputFieldCount,
}: {
	hasAudio: boolean;
	hasFiles: boolean;
	hasText: boolean;
	inputFieldCount: number;
}) => {
	if (inputFieldCount === 0) {
		throw new ORPCError("BAD_REQUEST", {
			message: "Keine Eingabefelder zum Ausfüllen verfügbar.",
		});
	}

	if (hasAudio || hasFiles || hasText) {
		return;
	}

	throw new ORPCError("BAD_REQUEST", {
		message: "Bitte Audio aufnehmen, Textkontext eingeben oder Dateien hinzufügen.",
	});
};

const describeMediaPlan = (plan: MediaPlan<unknown> | undefined): string | undefined => {
	if (!plan) {
		return undefined;
	}
	return plan.mode === "native" ? "native" : `preprocess-${plan.strategy}`;
};

const prepareFillInputsAudio = async ({
	audioFiles,
	db,
	generationStrategy,
	userId,
	zdr,
}: {
	audioFiles: FillInputsInputPayload["audioFiles"];
	db: Database;
	generationStrategy: FillInputsGenerationStrategy;
	userId: string;
	zdr: boolean;
}): Promise<FillInputsPreparedAudio> => {
	const files = audioFiles ?? [];
	if (files.length === 0) {
		return { contentParts: [], strategy: "native", transcripts: [] };
	}

	const audioPlan = generationStrategy.audio;
	if (!audioPlan) {
		throw new ORPCError("BAD_REQUEST", { message: USER_MESSAGES.modelUnavailable });
	}

	if (audioPlan.mode === "native") {
		return prepareAudioInputForModel({
			audioFiles: files,
			db,
			mode: "native",
			resolvedModel: generationStrategy.generation.model,
			userId,
			zdr,
		});
	}

	if (audioPlan.strategy === "multimodal") {
		const transcripts = await transcribeAudioFilesWithPrompt({
			audioFiles: files,
			db,
			resolvedModel: audioPlan.selection.model,
			userId,
			zdr,
		});
		return { contentParts: [], strategy: "transcription", transcripts };
	}

	return prepareAudioInputForModel({
		audioFiles: files,
		db,
		mode: "transcription",
		resolvedModel: audioPlan.selection.model,
		userId,
		zdr,
	});
};

const extractFillInputFileText = async ({
	citationSources,
	contextFiles,
	db,
	generationStrategy,
	hasFiles,
	userId,
	zdr,
}: {
	citationSources: string[];
	contextFiles: FillInputsInputPayload["contextFiles"];
	db: Database;
	generationStrategy: FillInputsGenerationStrategy;
	hasFiles: boolean;
	userId: string;
	zdr: boolean;
}) => {
	const filesPlan = generationStrategy.files;
	if (hasFiles && filesPlan?.mode === "preprocess") {
		const extractedFiles = await extractContextFiles({
			citationSources,
			contextFiles: contextFiles ?? [],
			db,
			modelSelection: filesPlan.selection,
			userId,
			zdr,
		});
		if (!extractedFiles.textContext) {
			throw new ORPCError("BAD_REQUEST", {
				message:
					"Die Dateianalyse hat keinen Text geliefert. Bitte die Dateien oder das OCR-Modell prüfen.",
			});
		}
		return extractedFiles;
	}

	return { ocrResults: [], textContext: "" };
};

const buildFillInputUserContent = ({
	nativeContextFiles,
	preparedAudio,
	userPrompt,
}: {
	nativeContextFiles: FillInputsInputPayload["contextFiles"];
	preparedAudio: FillInputsPreparedAudio;
	userPrompt: string;
}) => {
	const hasNativeAudioParts = preparedAudio.contentParts.length > 0;
	if (hasNativeAudioParts || (nativeContextFiles?.length ?? 0) > 0) {
		return [
			{ text: userPrompt, type: "text" as const },
			...preparedAudio.contentParts,
			...createContextFileParts(nativeContextFiles ?? []),
		];
	}

	return userPrompt;
};

const buildFillInputUsageMetadata = ({
	fileTextContext,
	generationSelection,
	generationStrategy,
	payloadSummary,
	preparedAudio,
	zdr,
}: {
	fileTextContext: string;
	generationSelection: FillInputsGenerationSelection;
	generationStrategy: FillInputsGenerationStrategy;
	payloadSummary: FillInputPayloadSummary;
	preparedAudio: FillInputsPreparedAudio;
	zdr: boolean;
}): UsageMetadata => ({
	credentialSource: generationSelection.model.credentialSource,
	endpoint: "input_fill",
	generationStrategy: {
		audioMode: describeMediaPlan(generationStrategy.audio),
		fileMode: describeMediaPlan(generationStrategy.files),
		usedFilePreprocessing: Boolean(fileTextContext),
		usedNativeAudio: preparedAudio.contentParts.length > 0,
		usedTranscription: preparedAudio.transcripts.length > 0,
	},
	modelConfig: {
		reasoningEffort: generationSelection.reasoningEffort,
		temperature: generationSelection.defaultTemperature ?? undefined,
	},
	payloadSummary,
	preprocessing: {
		fileImageModel:
			generationStrategy.files?.mode === "preprocess"
				? generationStrategy.files.selection.model.modelName
				: undefined,
		speechToTextModel:
			generationStrategy.audio?.mode === "preprocess"
				? generationStrategy.audio.selection.model.modelName
				: undefined,
	},
	promptName: FILL_INPUTS_PROMPT_NAME,
	providerProtocol: generationSelection.model.providerProtocol,
	zdrEnabled: zdr,
});

const resolveFillInputDecisionProvider = async (
	db: Database,
	input: FillInputsInputPayload,
	strategy: FillInputsGenerationStrategy,
	userId: string,
) => {
	const files = input.contextFiles ?? [];
	// An unseen native source must not contradict text-only decisions. Missing
	// source IDs cannot produce citations; don't spend money or quota on that path.
	if (
		input.audioFiles?.length ||
		(files.length && strategy.files?.mode !== "preprocess") ||
		!files.every((file) => file.id?.trim()) ||
		!getCitationSources(input).length ||
		!input.inputFields.some(supportsDecision)
	) {
		return null;
	}
	const provider = await resolveDecisionModel(db, userId).catch(() => null);
	// Fully BYOK requests must not spend operator credit or send data to an unconfigured provider.
	return isGenerationStrategyFullyByok(strategy) && provider?.credentialSource !== "user_byok"
		? null
		: provider;
};

const buildFillInputContext = (input: FillInputsInputPayload) => {
	const examples = (input.templateExamples ?? []).map((example) => example.trim()).filter(Boolean);
	const information = input.templateInformation?.trim();
	return composeScribeContext({
		formData: { ...input.textContext },
		template:
			information || examples.length
				? { content: "", examples, information, title: "Ausfüllhinweise" }
				: null,
	}).contextXml;
};

/** Optional text-only fast path; this boundary owns accounting and LLM fallback. */
const prepareFillInputDecisions = async ({
	citationSources,
	db,
	extractedFiles,
	input,
	provider,
	signal,
	userId,
	zdr,
}: {
	citationSources: FillInputsCitationSource[];
	db: Database;
	extractedFiles: Awaited<ReturnType<typeof extractFillInputFileText>>;
	input: FillInputsInputPayload;
	provider: DecisionModelSelection | null;
	signal?: AbortSignal;
	userId: string;
	zdr: boolean;
}): Promise<FillInputsResult["suggestions"]> => {
	if (!provider) {
		return {};
	}
	const contextFiles = input.contextFiles ?? [];
	const sources = [
		...Object.entries(input.textContext ?? {}).flatMap(([id, text]) =>
			text?.trim() ? [{ source: createMdscribeSource("input", id), text }] : [],
		),
		...extractedFiles.ocrResults.flatMap((result, index) => {
			const id = contextFiles[index]?.id?.trim();
			return id ? [{ source: createMdscribeSource("file", id), text: result.text }] : [];
		}),
	];
	// Without one stable ID per source, prefill cannot return honest citations.
	if (sources.length !== citationSources.length) {
		return {};
	}
	const budget = AbortSignal.timeout(3000);
	const started = Date.now();
	return await fillInputsWithDecisions({
		apiKey: provider.apiKey,
		context: buildFillInputsSourceContext({
			contextXml: buildFillInputContext(input),
			fileTextContext: extractedFiles.textContext,
		}),
		inputFields: input.inputFields,
		model: provider.modelId,
		onUsage: ({ model, usage }) => {
			const timeToCompletionMs = Date.now() - started;
			logMediaPreprocessingUsage({
				db,
				isOpenRouter: true,
				metadata: {
					credentialSource: provider.credentialSource,
					promptName: "input_fill:decision",
					providerId: provider.providerId,
					providerProtocol: "openrouter",
				},
				modelName: model,
				name: AI_INPUT_FILL_EVENT_NAME,
				providerMetadata: {
					openrouter: {
						usage: {
							completionTokens: usage.output_tokens,
							cost: usage.cost,
							promptTokens: usage.input_tokens,
							totalTokens: usage.input_tokens + usage.output_tokens,
						},
					},
				},
				timing: { timeToCompletionMs },
				userId,
				zdr,
			});
		},
		signal: signal ? AbortSignal.any([signal, budget]) : budget,
		sources,
		zdr,
	}).catch(() => {
		signal?.throwIfAborted();
		return {};
	});
};

const fillInputsProcedure = authed
	.use(scribeEntitlementsMiddleware)
	.input(type<FillInputsInputPayload>());

type FillInputsOptions = Parameters<Parameters<typeof fillInputsProcedure.handler>[0]>[0];

/** Fills `inputFields` from audio, text context and context files. */
const fillInputs = async ({
	input,
	context,
	signal,
}: FillInputsOptions): Promise<FillInputsResult> => {
	const audioFiles = input.audioFiles ?? [];
	const contextFiles = input.contextFiles ?? [];
	const hasAudio = audioFiles.length > 0;
	const hasFiles = contextFiles.length > 0;
	const hasText = hasTextContext(input);
	const payloadSummary = summarizeAndValidatePayload(input);

	assertFillInputsRequest({
		hasAudio,
		hasFiles,
		hasText,
		inputFieldCount: input.inputFields.length,
	});

	const generationStrategy = await resolveGenerationStrategy(context.db, {
		hasAudio,
		hasFiles,
		userId: context.session.user.id,
	}).catch((error: unknown) => {
		const message = error instanceof Error ? error.message : USER_MESSAGES.unknownError;
		throw new ORPCError("BAD_REQUEST", { message });
	});
	const decisionModel = await resolveFillInputDecisionProvider(
		context.db,
		input,
		generationStrategy,
		context.session.user.id,
	);
	const { entitlements } = await enforceScribeUsageLimit({
		db: context.db,
		entitlements: context.entitlements.scribe,
		// The decision model is only used for such requests with the user's own key.
		isQuotaExempt: isGenerationStrategyFullyByok(generationStrategy),
		session: context.session,
	});

	const generationSelection = generationStrategy.generation;
	const preparedAudio = await prepareFillInputsAudio({
		audioFiles,
		db: context.db,
		generationStrategy,
		userId: context.session.user.id,
		zdr: entitlements.hasActiveSubscription,
	}).catch((error: unknown) => {
		if (error instanceof ORPCError) {
			throw error;
		}
		const message = error instanceof Error ? error.message : USER_MESSAGES.unknownError;
		throw new ORPCError("BAD_REQUEST", { message });
	});
	const citationSources = getCitationSources(input);
	const sourceUris = citationSources.map(({ source }) => source);
	const extractedFiles = await extractFillInputFileText({
		citationSources: sourceUris,
		contextFiles,
		db: context.db,
		generationStrategy,
		hasFiles,
		userId: context.session.user.id,
		zdr: entitlements.hasActiveSubscription,
	});
	const filesAreNative = generationStrategy.files?.mode === "native";
	const nativeContextFiles = filesAreNative ? contextFiles : [];
	const prefilled = await prepareFillInputDecisions({
		citationSources,
		db: context.db,
		extractedFiles,
		input,
		provider: decisionModel,
		signal,
		userId: context.session.user.id,
		zdr: entitlements.hasActiveSubscription,
	});
	const remainingFields = input.inputFields.filter(
		(field) => !Object.hasOwn(prefilled, field.label),
	);
	if (!remainingFields.length) {
		return { ocrResults: extractedFiles.ocrResults, suggestions: prefilled };
	}
	const messages = composeFillInputsPrompt({
		audioTranscripts: formatAudioTranscriptsForPrompt(preparedAudio.transcripts),
		citationSources,
		contextFiles: nativeContextFiles,
		contextXml: buildFillInputContext(input),
		fileTextContext: extractedFiles.textContext,
		inputFields: remainingFields,
	});

	const outputSchema = createFillInputsSchema(remainingFields, sourceUris, hasAudio);

	const userContent = buildFillInputUserContent({
		nativeContextFiles,
		preparedAudio,
		userPrompt: messages[1]?.content ?? "",
	});
	const generationModel = generationSelection.model.model;

	const result = await generateText({
		abortSignal: signal,
		messages: [
			{ content: messages[0]?.content ?? "", role: "system" },
			{ content: userContent, role: "user" },
		],
		model:
			typeof generationModel === "string" || generationModel.specificationVersion !== "v3"
				? generationModel
				: wrapLanguageModel({
						middleware: extractJsonMiddleware({ transform: normalizeGeneratedJson }),
						model: generationModel,
					}),
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
		temperature: generationSelection.defaultTemperature ?? undefined,
	}).catch((error: unknown) => {
		const details = error instanceof Error ? error.message : USER_MESSAGES.unknownError;
		throw new ORPCError("BAD_REQUEST", {
			message: `Ausfüllen fehlgeschlagen. (${details})`,
		});
	});

	// `result.output` is a lazy getter that throws NoOutputGeneratedError when
	// the model did not finish with reason "stop" (e.g. truncated on length or
	// stopped by a content filter), so the structured output was never parsed.
	// Surface that as a clean BAD_REQUEST instead of an uncaught 500.
	const resultOutput = readStructuredOutput(result);
	if (resultOutput === null || resultOutput === undefined) {
		throw new ORPCError("BAD_REQUEST", {
			message: `Ausfüllen fehlgeschlagen. (Modell lieferte keine verwertbare Ausgabe, finishReason=${result.finishReason}.)`,
		});
	}

	const fillResult = toFillInputsResult(resultOutput, outputSchema, sourceUris);
	fillResult.suggestions = { ...prefilled, ...fillResult.suggestions };
	const openRouterUsage = generationSelection.model.isOpenRouter
		? extractOpenRouterUsage(
				(result as { providerMetadata?: Record<string, unknown> }).providerMetadata,
			)
		: undefined;
	const usageMetadata = buildFillInputUsageMetadata({
		fileTextContext: extractedFiles.textContext,
		generationSelection,
		generationStrategy,
		payloadSummary,
		preparedAudio,
		zdr: entitlements.hasActiveSubscription,
	});

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
				: JSON.stringify(fillResult.suggestions),
			standardUsage: result.usage as StandardUsage,
			userId: context.session.user.id,
		}),
	);

	return { ocrResults: extractedFiles.ocrResults, suggestions: fillResult.suggestions };
};

export const fillInputsHandler = fillInputsProcedure.handler(fillInputs);
