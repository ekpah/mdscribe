import { ORPCError, streamToEventIterator, type } from "@orpc/server";
import { and, eq, or, template as templateTable } from "@repo/database";
import type { Database } from "@repo/database";
import { createUIMessageStream, streamText } from "ai";
import type { ModelMessage, UIMessage } from "ai";

import {
	createResponseCitationSources,
	writeResponseCitations,
} from "@/features/response-citations/server";
import type { Session } from "@/lib/auth-types";
import { FILL_INPUT_PAYLOAD_LIMITS } from "@/lib/input-fill-limits";
import type { OcrResult, OcrUIMessage } from "@/lib/ocr-types";
import { AI_SCRIBE_GENERATION_EVENT_NAME } from "@/lib/usage-event-names";
import { USER_MESSAGES } from "@/lib/user-messages";
import { authed } from "@/orpc";
import { scribeEntitlementsMiddleware } from "@/orpc/middlewares/entitlements";
import { toTrimmedString } from "@/orpc/scribe/_lib/text";
import { composeUserContext } from "@/orpc/scribe/context/user";
import { resolveCitationDecisionModel } from "@/orpc/scribe/decisions/cite";
import {
	formatAudioTranscriptsForPrompt,
	prepareAudioInputForModel,
	transcribeAudioFilesWithPrompt,
} from "@/orpc/scribe/handlers/audio-input";
import {
	createContextFileParts,
	extractContextFiles,
	formatContextFileMetadataForPrompt,
} from "@/orpc/scribe/handlers/context-file-input";
import {
	assertAtMost,
	validateScribeAudioFiles,
	validateScribeContextFiles,
} from "@/orpc/scribe/handlers/media-limits";
import { logMediaPreprocessingUsage } from "@/orpc/scribe/handlers/preprocessing-usage";
import { enforceScribeUsageLimit } from "@/orpc/scribe/handlers/usage-limit";
import { scheduleScribeUsageLogging } from "@/orpc/scribe/handlers/usage-logging";
import {
	composeTemplatePrompt,
	evidenceInputs,
	TEXT_INPUT_IDS,
} from "@/orpc/scribe/prompts/template";
import type { NamedInput } from "@/orpc/scribe/prompts/template";
import {
	buildProviderOptions,
	isGenerationStrategyFullyByok,
	modelAllowsReasoningOptions,
	resolveGenerationStrategy,
} from "@/orpc/scribe/providers";
import type {
	AudioFile,
	FillInputsContextFile,
	ModelConfig,
	PromptMessage,
} from "@/orpc/scribe/types";
import { getUserPersonalContext } from "@/orpc/user/personal-context";

import type { ScribeEntitlements } from "./usage-limit";

export const DEFAULT_SCRIBE_MODEL_CONFIG: ModelConfig = {
	maxTokens: 8000,
};

const parsePromptPayload = (prompt: string): Record<string, unknown> => {
	if (!prompt.trim()) {
		return {};
	}
	try {
		const parsed = JSON.parse(prompt) as unknown;
		if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
			throw new ORPCError("BAD_REQUEST", {
				message: USER_MESSAGES.inputInvalid,
			});
		}
		return parsed as Record<string, unknown>;
	} catch (error) {
		if (error instanceof ORPCError) {
			throw error;
		}
		throw new ORPCError("BAD_REQUEST", {
			message: USER_MESSAGES.inputInvalid,
		});
	}
};

const hasNonEmptyInput = (value: unknown): boolean => {
	if (typeof value === "string") {
		return value.trim().length > 0;
	}
	if (typeof value === "number" || typeof value === "boolean") {
		return true;
	}
	if (Array.isArray(value)) {
		for (const entry of value) {
			if (hasNonEmptyInput(entry)) {
				return true;
			}
		}
		return false;
	}
	if (value && typeof value === "object") {
		for (const entry of Object.values(value as Record<string, unknown>)) {
			if (hasNonEmptyInput(entry)) {
				return true;
			}
		}
	}
	return false;
};

const hasFileLikeInput = (value: unknown): boolean => {
	if (Array.isArray(value)) {
		for (const entry of value) {
			if (hasFileLikeInput(entry)) {
				return true;
			}
		}
		return false;
	}

	if (value && typeof value === "object") {
		const record = value as Record<string, unknown>;

		const mimeTypeValue = record.mimeType ?? record.mediaType;
		if (typeof mimeTypeValue === "string") {
			const mimeType = mimeTypeValue.toLowerCase();
			if (mimeType.startsWith("image/") || mimeType.startsWith("application/pdf")) {
				return true;
			}
		}

		for (const entry of Object.values(record)) {
			if (hasFileLikeInput(entry)) {
				return true;
			}
		}
	}

	return false;
};

const appendTextToLastUserMessage = (messages: ModelMessage[], text: string): ModelMessage[] => {
	if (!text) {
		return messages;
	}

	const lastUserIndex = messages.findLastIndex((message) => message.role === "user");
	if (lastUserIndex === -1) {
		return [...messages, { content: text, role: "user" }];
	}

	return messages.map((message, index) => {
		if (index !== lastUserIndex || message.role !== "user") {
			return message;
		}

		if (typeof message.content === "string") {
			return {
				...message,
				content: `${message.content}\n\n${text}`,
			};
		}

		return {
			...message,
			content: [
				...message.content,
				{
					text,
					type: "text" as const,
				},
			],
		};
	});
};

const appendFilePartsToLastUserMessage = (
	messages: ModelMessage[],
	fileParts: ReturnType<typeof createContextFileParts>,
): ModelMessage[] => {
	if (fileParts.length === 0) {
		return messages;
	}

	const lastUserIndex = messages.findLastIndex((message) => message.role === "user");
	if (lastUserIndex === -1) {
		return [...messages, { content: fileParts, role: "user" }];
	}

	return messages.map((message, index) => {
		if (index !== lastUserIndex || message.role !== "user") {
			return message;
		}

		return {
			...message,
			content:
				typeof message.content === "string"
					? [
							{
								text: message.content,
								type: "text" as const,
							},
							...fileParts,
						]
					: [...message.content, ...fileParts],
		};
	});
};

/** Generates text from a template; the payload is `{ notes, background?, sections?, targetSectionId? }`. */
export interface ScribeStreamInput {
	templateId: string;
	messages: UIMessage[];
	audioFiles?: AudioFile[];
	/**
	 * Transcripts of the case's recordings from an earlier generation, sent instead of
	 * the audio so it is not transcribed again; ignored when `audioFiles` are sent.
	 */
	audioTranscripts?: string[];
	contextFiles?: FillInputsContextFile[];
}

export interface ScribeGenerationContext {
	db: Database;
	entitlements: { scribe: ScribeEntitlements };
	session: Session;
}

export interface ScribeGenerationTraceContext {
	agentSectionId?: string;
	agentRunId?: string;
	observationId?: string;
	traceId?: string;
}

interface ResolvedScribeRequest {
	config: {
		modelConfig: ModelConfig;
		promptLabel?: string;
		promptName: string;
	};
	endpoint: string;
	/** Evidence text inputs; the citation pass cites these, files and audio. */
	inputs: NamedInput[];
	promptMessages: PromptMessage[];
	usageMetadata?: {
		templateId: string;
	};
}

/**
 * Extract prompt text from the last user message
 */
const extractPromptFromMessages = (messages: UIMessage[]): string => {
	const lastUserMessage = messages.findLast((m) => m.role === "user");
	if (!lastUserMessage) {
		return "";
	}

	// Extract text from parts when available (AI SDK UIMessage)
	if (lastUserMessage.parts) {
		return lastUserMessage.parts
			.filter((p) => p.type === "text")
			.map((p) => (p as { type: "text"; text: string }).text)
			.join("");
	}

	// Fallback to content string if parts are not present
	if ("content" in lastUserMessage) {
		const { content } = lastUserMessage as { content?: unknown };
		if (typeof content === "string") {
			return content;
		}
	}

	return "";
};

const toStringRecord = (value: unknown): Record<string, string> =>
	value && typeof value === "object"
		? Object.fromEntries(
				Object.entries(value).filter(
					(entry): entry is [string, string] => typeof entry[1] === "string",
				),
			)
		: {};

// Payload: { notes, background?, sections?: { [sectionId]: text }, targetSectionId? }.
const resolveTemplateRequest = async ({
	db,
	formData,
	personalContext,
	sessionUser,
	templateId,
}: {
	db: Database;
	formData: Record<string, unknown>;
	personalContext: string;
	sessionUser: Session["user"];
	templateId: string;
}): Promise<ResolvedScribeRequest> => {
	const found = await db.query.template.findFirst({
		where: and(
			eq(templateTable.id, templateId),
			or(eq(templateTable.visibility, "public"), eq(templateTable.authorId, sessionUser.id)),
		),
	});
	if (!found) {
		throw new ORPCError("NOT_FOUND", { message: "Template wurde nicht gefunden" });
	}

	const promptInput = {
		...Object.fromEntries(TEXT_INPUT_IDS.map((id) => [id, toTrimmedString(formData[id])])),
		sections: toStringRecord(formData.sections),
		targetSectionId: toTrimmedString(formData.targetSectionId) || undefined,
		template: found,
		userContext: composeUserContext(sessionUser, personalContext),
	};
	return {
		config: {
			modelConfig: DEFAULT_SCRIBE_MODEL_CONFIG,
			promptLabel: found.title,
			promptName: "template",
		},
		endpoint: `template:${found.id}`,
		inputs: evidenceInputs(promptInput),
		promptMessages: composeTemplatePrompt(promptInput),
		usageMetadata: { templateId: found.id },
	};
};

type PreparedAudio = Awaited<ReturnType<typeof prepareAudioInputForModel>>;
export type ResolvedGenerationStrategy = Awaited<ReturnType<typeof resolveGenerationStrategy>>;
interface PreparedContextFiles {
	fileParts: ReturnType<typeof createContextFileParts>;
	fileTextContext: string;
	metadataPrompt: string;
	mode: "native" | "text";
	ocrResults: OcrResult[];
}

const appendNativeAudioToMessages = (
	messages: ModelMessage[],
	preparedAudio: PreparedAudio,
): ModelMessage[] => {
	const audioInstructionPart = {
		text: [
			"<audio_context>",
			"Die angehängten Audioaufnahmen sind klinischer Input für diese Anfrage.",
			"Berücksichtige die gesprochenen Inhalte vollständig und nutze sie wie zusätzliche Nutzerangaben.",
			"Wenn Textfelder leer sind oder von der Audioaufnahme abweichen, verwende die Audioaufnahme als eigenständige Quelle.",
			"</audio_context>",
		].join("\n"),
		type: "text" as const,
	};

	const lastMessage = messages.at(-1);
	if (lastMessage?.role === "user") {
		const content =
			typeof lastMessage.content === "string"
				? [
						{
							text: lastMessage.content,
							type: "text" as const,
						},
						audioInstructionPart,
						...preparedAudio.contentParts,
					]
				: [...lastMessage.content, audioInstructionPart, ...preparedAudio.contentParts];

		return [
			...messages.slice(0, -1),
			{
				...lastMessage,
				content,
			},
		];
	}

	return [
		...messages,
		{
			content: [audioInstructionPart, ...preparedAudio.contentParts],
			role: "user",
		},
	];
};

const appendPreparedAudioToMessages = (
	messages: ModelMessage[],
	preparedAudio: PreparedAudio,
): ModelMessage[] => {
	if (preparedAudio.strategy === "transcription") {
		return appendTextToLastUserMessage(
			messages,
			formatAudioTranscriptsForPrompt(preparedAudio.transcripts),
		);
	}

	return appendNativeAudioToMessages(messages, preparedAudio);
};

const appendPreparedContextFilesToMessages = (
	messages: ModelMessage[],
	preparedFiles: PreparedContextFiles,
): ModelMessage[] => {
	if (preparedFiles.mode === "native") {
		const withMetadata = appendTextToLastUserMessage(messages, preparedFiles.metadataPrompt);
		return appendFilePartsToLastUserMessage(withMetadata, preparedFiles.fileParts);
	}

	return appendTextToLastUserMessage(
		messages,
		[preparedFiles.metadataPrompt, preparedFiles.fileTextContext].filter(Boolean).join("\n\n"),
	);
};

const prepareContextFilesForMessages = async ({
	contextFiles,
	db,
	generationStrategy,
	userId,
	zdr,
}: {
	contextFiles: FillInputsContextFile[];
	db: Database;
	generationStrategy: ResolvedGenerationStrategy;
	userId: string;
	zdr: boolean;
}): Promise<PreparedContextFiles> => {
	const filesPlan = generationStrategy.files;
	if (!filesPlan) {
		throw new ORPCError("BAD_REQUEST", {
			message: USER_MESSAGES.modelUnavailable,
		});
	}

	const fileMetadataPrompt = formatContextFileMetadataForPrompt(contextFiles);
	if (filesPlan.mode === "native") {
		return {
			fileParts: createContextFileParts(contextFiles),
			fileTextContext: "",
			metadataPrompt: fileMetadataPrompt,
			mode: "native",
			ocrResults: [],
		};
	}

	const extractedFiles = await extractContextFiles({
		contextFiles,
		db,
		modelSelection: filesPlan.selection,
		userId,
		zdr,
	});
	return {
		fileParts: [],
		fileTextContext: extractedFiles.textContext,
		metadataPrompt: fileMetadataPrompt,
		mode: "text",
		ocrResults: extractedFiles.ocrResults,
	};
};

const resolveReasoningEffort = (
	config: ModelConfig,
	generationSelection: ResolvedGenerationStrategy["generation"],
) => config.reasoningEffort ?? (config.thinking ? "medium" : generationSelection.reasoningEffort);

export const appendScribeInputAttachmentsToMessages = async ({
	audioFiles,
	contextFiles,
	db,
	generationStrategy,
	messages,
	userId,
	zdr,
}: {
	audioFiles: AudioFile[];
	contextFiles: FillInputsContextFile[];
	db: Database;
	generationStrategy: ResolvedGenerationStrategy;
	messages: ModelMessage[];
	userId: string;
	zdr: boolean;
}): Promise<{
	audioTranscripts: string[];
	fileTextContext: string;
	messages: ModelMessage[];
	ocrResults: OcrResult[];
}> => {
	const prepareAudio = async (): Promise<PreparedAudio | null> => {
		if (audioFiles.length === 0) {
			return null;
		}

		const audioPlan = generationStrategy.audio;
		if (!audioPlan) {
			throw new ORPCError("BAD_REQUEST", {
				message: USER_MESSAGES.modelUnavailable,
			});
		}

		if (audioPlan.mode === "native") {
			return prepareAudioInputForModel({
				audioFiles,
				db,
				mode: "native",
				resolvedModel: generationStrategy.generation.model,
				userId,
				zdr,
			});
		}

		if (audioPlan.strategy === "multimodal") {
			return {
				contentParts: [],
				strategy: "transcription",
				transcripts: await transcribeAudioFilesWithPrompt({
					audioFiles,
					db,
					resolvedModel: audioPlan.selection.model,
					userId,
					zdr,
				}),
			};
		}

		return prepareAudioInputForModel({
			audioFiles,
			db,
			mode: "transcription",
			resolvedModel: audioPlan.selection.model,
			userId,
			zdr,
		});
	};

	const prepareFiles = (): Promise<PreparedContextFiles | null> | null =>
		contextFiles.length > 0
			? prepareContextFilesForMessages({
					contextFiles,
					db,
					generationStrategy,
					userId,
					zdr,
				})
			: null;

	const [preparedAudio, preparedFiles] = await Promise.all([prepareAudio(), prepareFiles()]).catch(
		(error: unknown) => {
			const message = error instanceof Error ? error.message : USER_MESSAGES.unknownError;
			throw new ORPCError("BAD_REQUEST", { message });
		},
	);

	const withAudio = preparedAudio
		? appendPreparedAudioToMessages(messages, preparedAudio)
		: messages;
	const nextMessages = preparedFiles
		? appendPreparedContextFilesToMessages(withAudio, preparedFiles)
		: withAudio;

	return {
		audioTranscripts: preparedAudio?.transcripts ?? [],
		fileTextContext: preparedFiles?.fileTextContext ?? "",
		messages: nextMessages,
		ocrResults: preparedFiles?.ocrResults ?? [],
	};
};

/**
 * Transcripts an earlier generation returned for the same recordings. They take
 * the place of the audio, so they keep the audio count limit and a transcript of
 * at most the longest recording.
 */
const toReusedTranscripts = (transcripts: unknown): string[] => {
	const reused = (Array.isArray(transcripts) ? transcripts : []).filter(
		(transcript): transcript is string =>
			typeof transcript === "string" && Boolean(transcript.trim()),
	);
	assertAtMost(
		reused.length,
		FILL_INPUT_PAYLOAD_LIMITS.maxAudioFiles,
		`Maximal ${FILL_INPUT_PAYLOAD_LIMITS.maxAudioFiles} Audioaufnahmen können berücksichtigt werden.`,
	);
	for (const transcript of reused) {
		assertAtMost(
			transcript.length,
			FILL_INPUT_PAYLOAD_LIMITS.maxAudioTranscriptCharacters,
			"Ein Transkript ist zu lang. Bitte die Aufnahme erneut hochladen.",
		);
	}
	return reused;
};

/**
 * Main streaming handler for all scribe document types
 */
/**
 * Executes the canonical scribe pipeline. Transport adapters may stream the
 * returned result or await its text; validation, prompt resolution, media
 * handling, provider selection, and UsageEvent logging stay in one place.
 */
export const runScribeGeneration = async ({
	context,
	input,
	preparedAttachmentText,
	signal,
	traceContext,
}: {
	context: ScribeGenerationContext;
	input: ScribeStreamInput;
	/** Trusted server-side text from an already completed agent preprocessing step. */
	preparedAttachmentText?: string;
	signal?: AbortSignal;
	traceContext?: ScribeGenerationTraceContext;
}) => {
	const inputMessages = input.messages;
	const audioFiles = input.audioFiles ?? [];
	const contextFiles = input.contextFiles ?? [];
	validateScribeAudioFiles(audioFiles);
	const contextFileSummaries = validateScribeContextFiles(contextFiles);

	// Extract prompt from the last user message
	const prompt = extractPromptFromMessages(inputMessages);

	// Validate input
	const reusedTranscripts =
		audioFiles.length > 0 ? [] : toReusedTranscripts(input.audioTranscripts);
	const hasAudio = audioFiles.length > 0;
	const hasContextFiles = contextFiles.length > 0;
	const rawPrompt = parsePromptPayload(prompt);
	const promptFacts = [
		...TEXT_INPUT_IDS.map((id) => rawPrompt[id]),
		...Object.values(toStringRecord(rawPrompt.sections)),
	];
	if (!(hasAudio || reusedTranscripts.length || hasContextFiles || hasNonEmptyInput(promptFacts))) {
		throw new ORPCError("BAD_REQUEST", {
			message: USER_MESSAGES.missingInput,
		});
	}

	const hasFileInput = hasFileLikeInput(rawPrompt);
	const personalContext = await getUserPersonalContext(context.db, context.session.user.id);
	const resolvedRequestPromise = resolveTemplateRequest({
		db: context.db,
		formData: rawPrompt,
		personalContext,
		sessionUser: context.session.user,
		templateId: input.templateId,
	});

	const [resolvedRequest, generationStrategy] = await Promise.all([
		resolvedRequestPromise,
		resolveGenerationStrategy(context.db, {
			hasAudio,
			hasFiles: hasFileInput || hasContextFiles,
			userId: context.session.user.id,
		}),
	]);
	const usageLimitResult = await enforceScribeUsageLimit({
		db: context.db,
		entitlements: context.entitlements.scribe,
		isQuotaExempt: isGenerationStrategyFullyByok(generationStrategy),
		session: context.session,
	});
	const { entitlements } = usageLimitResult;
	const generationSelection = generationStrategy.generation;

	const attachmentsResult = await appendScribeInputAttachmentsToMessages({
		audioFiles,
		contextFiles,
		db: context.db,
		generationStrategy,
		messages: resolvedRequest.promptMessages,
		userId: context.session.user.id,
		zdr: entitlements.hasActiveSubscription,
	});
	const audioTranscripts = [...attachmentsResult.audioTranscripts, ...reusedTranscripts];
	const messages = appendTextToLastUserMessage(
		attachmentsResult.messages,
		[
			reusedTranscripts.length ? formatAudioTranscriptsForPrompt(reusedTranscripts) : "",
			preparedAttachmentText ?? "",
		]
			.filter(Boolean)
			.join("\n\n"),
	);

	// Media that a preprocessing model parsed to text becomes part of the
	// logged notes so the event stays reviewable and replayable as text.
	const parsedMediaSections = [
		audioTranscripts.length > 0 ? formatAudioTranscriptsForPrompt(audioTranscripts) : "",
		attachmentsResult.fileTextContext,
		preparedAttachmentText ?? "",
	].filter(Boolean);
	const baseNotes = typeof rawPrompt.notes === "string" ? rawPrompt.notes : "";
	const usageInputData = {
		...rawPrompt,
		...(hasContextFiles && !("_contextFiles" in rawPrompt)
			? { _contextFiles: contextFileSummaries }
			: {}),
		...(parsedMediaSections.length > 0
			? { notes: [baseNotes, ...parsedMediaSections].filter(Boolean).join("\n\n") }
			: {}),
	};

	// Build provider options — only include OpenRouter-specific options when using OpenRouter
	const reasoningEffort = resolveReasoningEffort(
		resolvedRequest.config.modelConfig,
		generationSelection,
	);
	const providerOptions = buildProviderOptions({
		includeUsage: true,
		model: generationSelection.model,
		reasoningEffort,
		userId: context.session.user.id,
		zdr: entitlements.hasActiveSubscription,
	});

	// Effective temperature: explicit request value wins, then the global
	// admin-configured default, otherwise omit so the provider standard applies.
	const effectiveTemperature =
		resolvedRequest.config.modelConfig.temperature ??
		generationSelection.defaultTemperature ??
		undefined;

	// Stream the response
	const requestStartedAt = Date.now();
	let firstTokenAt: number | undefined;

	const result = streamText({
		abortSignal: signal,
		maxOutputTokens: resolvedRequest.config.modelConfig.maxTokens ?? 20_000,
		messages,
		model: generationSelection.model.model,
		onChunk: ({ chunk }) => {
			if (
				firstTokenAt === undefined &&
				(chunk.type === "text-delta" || chunk.type === "reasoning-delta") &&
				chunk.text.length > 0
			) {
				firstTokenAt = Date.now();
			}
		},
		onFinish: (event) => {
			const completedAt = Date.now();
			scheduleScribeUsageLogging({
				activeSubscription: entitlements.hasActiveSubscription,
				db: context.db,
				endpoint: resolvedRequest.endpoint,
				event,
				inputData: usageInputData,
				isOpenRouter: generationSelection.model.isOpenRouter,
				modelConfig: {
					...resolvedRequest.config.modelConfig,
					temperature: effectiveTemperature,
				},
				modelName: generationSelection.model.modelName,
				observationId: traceContext?.observationId,
				promptLabel: resolvedRequest.config.promptLabel,
				promptName: resolvedRequest.config.promptName,
				reasoningEffort:
					generationSelection.model.isOpenRouter &&
					modelAllowsReasoningOptions(generationSelection.model)
						? reasoningEffort
						: "none",
				timing: {
					timeToCompletionMs: completedAt - requestStartedAt,
					timeToFirstTokenMs:
						firstTokenAt === undefined ? undefined : firstTokenAt - requestStartedAt,
				},
				traceId: traceContext?.traceId,
				usageMetadata: {
					credentialSource: generationSelection.model.credentialSource,
					providerProtocol: generationSelection.model.providerProtocol,
					...resolvedRequest.usageMetadata,
					...traceContext,
				},
				userId: context.session.user.id,
			});
		},
		providerOptions,
		temperature: effectiveTemperature,
	});

	const citationSources = createResponseCitationSources({
		contextFiles,
		inputs: resolvedRequest.inputs,
		ocrResults: attachmentsResult.ocrResults,
	});

	return {
		/** Recordings transcribed for this request; the client sends them back instead of the audio. */
		audioTranscripts: attachmentsResult.audioTranscripts,
		citationSources,
		generation: result,
		ocrResults: attachmentsResult.ocrResults,
		async writeCitations(
			writer: Parameters<typeof writeResponseCitations>[0]["writer"],
			draft: string,
		) {
			const decisionTarget = await resolveCitationDecisionModel(
				context.db,
				context.session.user.id,
				isGenerationStrategyFullyByok(generationStrategy),
			);
			await writeResponseCitations({
				decision: decisionTarget && {
					onUsage: ({ model, usage }, durationMs) =>
						logMediaPreprocessingUsage({
							db: context.db,
							isOpenRouter: true,
							metadata: {
								credentialSource: decisionTarget.credentialSource,
								promptName: "citation:match-response",
								providerId: decisionTarget.providerId,
								providerProtocol: decisionTarget.protocol,
							},
							modelName: model,
							name: AI_SCRIBE_GENERATION_EVENT_NAME,
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
							timing: { timeToCompletionMs: durationMs },
							userId: context.session.user.id,
							zdr: entitlements.hasActiveSubscription,
						}),
					target: decisionTarget,
				},
				draft,
				llm: {
					model: generationSelection.model.model,
					onFinish: (event, durationMs) =>
						scheduleScribeUsageLogging({
							activeSubscription: entitlements.hasActiveSubscription,
							db: context.db,
							endpoint: `${resolvedRequest.endpoint}:citations`,
							event,
							inputData: {},
							isOpenRouter: generationSelection.model.isOpenRouter,
							modelConfig: { maxTokens: 4000, temperature: 0.3 },
							modelName: generationSelection.model.modelName,
							promptName: "citation:annotate-response",
							timing: { timeToCompletionMs: durationMs },
							usageMetadata: {
								credentialSource: generationSelection.model.credentialSource,
								providerProtocol: generationSelection.model.providerProtocol,
							},
							userId: context.session.user.id,
						}),
					providerOptions,
				},
				signal,
				sources: citationSources,
				writer,
			});
		},
	};
};

export const scribeStreamHandler = authed
	.use(scribeEntitlementsMiddleware)
	.input(type<ScribeStreamInput>())
	.handler(async ({ input, context, signal }) => {
		const { audioTranscripts, citationSources, generation, ocrResults, writeCitations } =
			await runScribeGeneration({
				context,
				input,
				signal,
			});
		const stream = createUIMessageStream<OcrUIMessage>({
			execute: async ({ writer }) => {
				if (ocrResults.length > 0) {
					writer.write({
						data: ocrResults,
						transient: true,
						type: "data-ocr-results",
					});
				}
				// Only one transcript per recording can be matched to its recording; a
				// combined or partial transcription is not sent back for reuse.
				if (audioTranscripts.length > 0 && audioTranscripts.length === input.audioFiles?.length) {
					writer.write({ data: audioTranscripts, transient: true, type: "data-audio-transcripts" });
				}
				// Forward the original text immediately, but keep the transport open
				// after text-end so citations can arrive individually on the same message.
				for await (const chunk of generation.toUIMessageStream<OcrUIMessage>({
					sendFinish: false,
				})) {
					writer.write(chunk);
				}
				const finishReason = await generation.finishReason;
				if (finishReason === "stop" && citationSources.length && !signal?.aborted) {
					await writeCitations(writer, await generation.text);
				}
				writer.write({ finishReason, type: "finish" });
			},
		});
		return streamToEventIterator(stream);
	});
