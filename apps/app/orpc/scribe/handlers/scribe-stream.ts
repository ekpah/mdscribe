import { ORPCError, streamToEventIterator, type } from "@orpc/server";
import { aiScribeFormConfig, and, eq, or } from "@repo/database";
import type { Database } from "@repo/database";
import { streamText } from "ai";
import type { ModelMessage, UIMessage } from "ai";

import {
	FILL_INPUT_PAYLOAD_LIMITS,
	formatPayloadBytes,
	getBase64DecodedByteLength,
} from "@/lib/input-fill-limits";
import { USER_MESSAGES } from "@/lib/user-messages";
import { authed } from "@/orpc";
import { scribeEntitlementsMiddleware } from "@/orpc/middlewares/entitlements";
import { composeScribeContext, findRelevantTemplateForProcedure } from "@/orpc/scribe/context";
import type { ContextBuildInput, TemplateContextInput } from "@/orpc/scribe/context";
import {
	formatAudioTranscriptsForPrompt,
	prepareAudioInputForModel,
} from "@/orpc/scribe/handlers/audio-input";
import {
	createContextFileParts,
	extractContextFileText,
	formatContextFileMetadataForPrompt,
} from "@/orpc/scribe/handlers/context-file-input";
import { enforceScribeUsageLimit } from "@/orpc/scribe/handlers/usage-limit";
import { scheduleScribeUsageLogging } from "@/orpc/scribe/handlers/usage-logging";
import {
	composeDocumentTypePrompt,
	composePromptHarnessPrompt,
	documentTypeConfigs,
	getPromptHarnessLabel,
	resolvePromptHarnessId,
} from "@/orpc/scribe/prompts";
import { buildProviderOptions, resolveGenerationStrategy } from "@/orpc/scribe/providers";
import type {
	AudioFile,
	DocumentType,
	FillInputsContextFile,
	ModelConfig,
	PromptMessage,
} from "@/orpc/scribe/types";

export const DEFAULT_SCRIBE_MODEL_CONFIG: ModelConfig = {
	maxTokens: 8000,
	temperature: 0.3,
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

export const validateScribeContextFiles = (contextFiles: FillInputsContextFile[]) => {
	if (contextFiles.length > FILL_INPUT_PAYLOAD_LIMITS.maxContextFiles) {
		throw new ORPCError("BAD_REQUEST", {
			message: `Maximal ${FILL_INPUT_PAYLOAD_LIMITS.maxContextFiles} Dateien können berücksichtigt werden.`,
		});
	}

	let totalBytes = 0;
	for (const file of contextFiles) {
		const payloadBytes = getBase64DecodedByteLength(file.data);
		totalBytes += payloadBytes;

		if (payloadBytes > FILL_INPUT_PAYLOAD_LIMITS.maxContextFileBytes) {
			throw new ORPCError("BAD_REQUEST", {
				message: `Die Datei "${file.name}" ist zu groß. Maximal erlaubt sind ${formatPayloadBytes(FILL_INPUT_PAYLOAD_LIMITS.maxContextFileBytes)} pro Datei.`,
			});
		}
	}

	if (totalBytes > FILL_INPUT_PAYLOAD_LIMITS.maxContextFilesTotalBytes) {
		throw new ORPCError("BAD_REQUEST", {
			message: `Die Dateien sind zusammen zu groß. Maximal erlaubt sind ${formatPayloadBytes(FILL_INPUT_PAYLOAD_LIMITS.maxContextFilesTotalBytes)}.`,
		});
	}
};

export const validateScribeAudioFiles = (audioFiles: AudioFile[]) => {
	if (audioFiles.length > FILL_INPUT_PAYLOAD_LIMITS.maxAudioFiles) {
		throw new ORPCError("BAD_REQUEST", {
			message: `Maximal ${FILL_INPUT_PAYLOAD_LIMITS.maxAudioFiles} Audioaufnahmen können berücksichtigt werden.`,
		});
	}

	let totalBytes = 0;
	for (const [index, audioFile] of audioFiles.entries()) {
		const payloadBytes = getBase64DecodedByteLength(audioFile.data);
		const wavFallbackBytes = getBase64DecodedByteLength(audioFile.wavFallback?.data);
		const recordingBytes = payloadBytes + wavFallbackBytes;
		totalBytes += recordingBytes;

		if (recordingBytes > FILL_INPUT_PAYLOAD_LIMITS.maxAudioPayloadBytesPerRecording) {
			throw new ORPCError("BAD_REQUEST", {
				message: `Audioaufnahme ${index + 1} ist zu groß. Maximal erlaubt sind ${formatPayloadBytes(FILL_INPUT_PAYLOAD_LIMITS.maxAudioPayloadBytesPerRecording)} pro Aufnahme.`,
			});
		}
	}

	if (totalBytes > FILL_INPUT_PAYLOAD_LIMITS.maxAudioPayloadBytesTotal) {
		throw new ORPCError("BAD_REQUEST", {
			message: `Die Audioaufnahmen sind zusammen zu groß. Maximal erlaubt sind ${formatPayloadBytes(FILL_INPUT_PAYLOAD_LIMITS.maxAudioPayloadBytesTotal)}.`,
		});
	}
};

const summarizeContextFilesForUsage = (contextFiles: FillInputsContextFile[]) =>
	contextFiles.map((file, index) => ({
		index: index + 1,
		mediaType: file.mimeType,
		name: file.name,
		payloadBytes: getBase64DecodedByteLength(file.data),
		size: file.size,
	}));

/**
 * Scribe input type - uses UIMessage[] for AI SDK useChat compatibility
 */
interface BuiltInScribeStreamInput {
	documentType: DocumentType;
	messages: UIMessage[];
	audioFiles?: AudioFile[];
	contextFiles?: FillInputsContextFile[];
	source?: "documentType";
}

interface CustomFormScribeStreamInput {
	formId: string;
	messages: UIMessage[];
	audioFiles?: AudioFile[];
	contextFiles?: FillInputsContextFile[];
	source: "customForm";
}

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

type ScribeStreamInput = BuiltInScribeStreamInput | CustomFormScribeStreamInput;

interface ResolvedScribeRequest {
	config: {
		modelConfig: ModelConfig;
		promptLabel?: string;
		promptName: string;
	};
	endpoint: string;
	promptMessages: PromptMessage[];
	usageMetadata?: {
		customFormId?: string;
		customFormSlug?: string;
		templateId?: string | null;
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

const toTemplateContextInput = (template: {
	content: string;
	examples: string[];
	title: string;
}): TemplateContextInput => ({
	content: template.content,
	examples: template.examples,
	title: template.title,
});

const readTrimmedStringField = (
	formData: Record<string, unknown>,
	field: string,
): string | undefined => {
	const raw = formData[field];
	if (typeof raw !== "string") {
		return undefined;
	}

	const trimmed = raw.trim();
	return trimmed.length > 0 ? trimmed : undefined;
};

const resolveBuiltInRequest = async ({
	documentType,
	formData,
	sessionUser,
}: {
	documentType: DocumentType;
	formData: Record<string, unknown>;
	sessionUser: ContextBuildInput["sessionUser"];
}): Promise<ResolvedScribeRequest> => {
	const config = documentTypeConfigs[documentType];
	if (!config) {
		throw new ORPCError("BAD_REQUEST", {
			message: `Unknown document type: ${documentType}`,
		});
	}

	const selectedTemplateReference =
		documentType === "procedures"
			? await findRelevantTemplateForProcedure(readTrimmedStringField(formData, "notes") ?? "")
			: undefined;
	const { contextPrompt, contextXml } = await composeScribeContext({
		formData,
		promptContextKey: documentType,
		selectedTemplateReference,
		sessionUser,
	});

	return {
		config: {
			modelConfig: DEFAULT_SCRIBE_MODEL_CONFIG,
			promptLabel: config.promptName,
			promptName: documentType,
		},
		endpoint: documentType,
		promptMessages: composeDocumentTypePrompt(documentType, {
			contextPrompt,
			contextXml,
		}),
	};
};

const resolveCustomFormRequest = async ({
	db,
	formData,
	formId,
	sessionUser,
}: {
	db: Database;
	formData: Record<string, unknown>;
	formId: string;
	sessionUser: NonNullable<ContextBuildInput["sessionUser"]>;
}): Promise<ResolvedScribeRequest> => {
	const customForm = await db.query.aiScribeFormConfig.findFirst({
		where: and(
			eq(aiScribeFormConfig.id, formId),
			or(
				eq(aiScribeFormConfig.visibility, "public"),
				eq(aiScribeFormConfig.authorId, sessionUser.id),
			),
		),
		with: {
			template: true,
		},
	});

	if (!customForm || !customForm.enabled) {
		throw new ORPCError("NOT_FOUND", {
			message: "AI Form wurde nicht gefunden",
		});
	}

	const promptHarnessId = resolvePromptHarnessId(customForm.promptHarness);
	if (!promptHarnessId) {
		throw new ORPCError("BAD_REQUEST", {
			message: `Unknown prompt harness: ${customForm.promptHarness}`,
		});
	}

	const template = customForm.template ? toTemplateContextInput(customForm.template) : null;
	const selectedTemplateReference =
		promptHarnessId === "procedures" && !template
			? await findRelevantTemplateForProcedure(readTrimmedStringField(formData, "notes") ?? "")
			: undefined;
	const { contextPrompt, contextXml } = await composeScribeContext({
		formData,
		promptContextKey: promptHarnessId,
		selectedTemplateReference,
		sessionUser,
		template,
	});

	const promptMessages = composePromptHarnessPrompt(promptHarnessId, {
		contextPrompt,
		contextXml,
	});
	if (!promptMessages) {
		throw new ORPCError("BAD_REQUEST", {
			message: `Unknown prompt harness: ${customForm.promptHarness}`,
		});
	}

	return {
		config: {
			modelConfig: DEFAULT_SCRIBE_MODEL_CONFIG,
			promptLabel: getPromptHarnessLabel(promptHarnessId),
			promptName: promptHarnessId,
		},
		endpoint: `custom:${customForm.slug}`,
		promptMessages,
		usageMetadata: {
			customFormId: customForm.id,
			customFormSlug: customForm.slug,
			templateId: customForm.templateId,
		},
	};
};

type PreparedAudio = Awaited<ReturnType<typeof prepareAudioInputForModel>>;
export type ResolvedGenerationStrategy = Awaited<ReturnType<typeof resolveGenerationStrategy>>;

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

const appendContextFilesToMessages = async ({
	contextFiles,
	generationStrategy,
	messages,
	userId,
	zdr,
}: {
	contextFiles: FillInputsContextFile[];
	generationStrategy: ResolvedGenerationStrategy;
	messages: ModelMessage[];
	userId: string;
	zdr: boolean;
}): Promise<ModelMessage[]> => {
	const fileMetadataPrompt = formatContextFileMetadataForPrompt(contextFiles);
	if (generationStrategy.mode === "direct") {
		const withMetadata = appendTextToLastUserMessage(messages, fileMetadataPrompt);
		return appendFilePartsToLastUserMessage(withMetadata, createContextFileParts(contextFiles));
	}

	const fileSelection = generationStrategy.fileImage ?? generationStrategy.generation;
	const fileTextContext = await extractContextFileText({
		contextFiles,
		modelSelection: fileSelection,
		userId,
		zdr,
	});
	return appendTextToLastUserMessage(
		messages,
		[fileMetadataPrompt, fileTextContext].filter(Boolean).join("\n\n"),
	);
};

const resolveReasoningEffort = (
	config: ModelConfig,
	generationSelection: ResolvedGenerationStrategy["generation"],
) => config.reasoningEffort ?? (config.thinking ? "medium" : generationSelection.reasoningEffort);

export const appendScribeInputAttachmentsToMessages = async ({
	audioFiles,
	contextFiles,
	generationStrategy,
	messages,
	userId,
	zdr,
}: {
	audioFiles: AudioFile[];
	contextFiles: FillInputsContextFile[];
	generationStrategy: ResolvedGenerationStrategy;
	messages: ModelMessage[];
	userId: string;
	zdr: boolean;
}): Promise<ModelMessage[]> => {
	let nextMessages = messages;

	if (audioFiles.length > 0) {
		const audioSelection =
			generationStrategy.mode === "direct"
				? generationStrategy.generation
				: generationStrategy.speechToText;
		if (!audioSelection) {
			throw new ORPCError("BAD_REQUEST", {
				message: USER_MESSAGES.modelUnavailable,
			});
		}
		const preparedAudio = await prepareAudioInputForModel({
			audioFiles,
			mode: generationStrategy.mode === "direct" ? "native" : "transcription",
			resolvedModel: audioSelection.model,
		}).catch((error: unknown) => {
			const message = error instanceof Error ? error.message : USER_MESSAGES.unknownError;
			throw new ORPCError("BAD_REQUEST", { message });
		});

		nextMessages = appendPreparedAudioToMessages(nextMessages, preparedAudio);
	}

	if (contextFiles.length > 0) {
		nextMessages = await appendContextFilesToMessages({
			contextFiles,
			generationStrategy,
			messages: nextMessages,
			userId,
			zdr,
		});
	}

	return nextMessages;
};

/**
 * Main streaming handler for all scribe document types
 */
export const scribeStreamHandler = authed
	.use(scribeEntitlementsMiddleware)
	.input(type<ScribeStreamInput>())
	.handler(async ({ input, context }) => {
		const inputMessages = input.messages;
		const audioFiles = input.audioFiles ?? [];
		const contextFiles = input.contextFiles ?? [];
		validateScribeAudioFiles(audioFiles);
		validateScribeContextFiles(contextFiles);

		// Extract prompt from the last user message
		const prompt = extractPromptFromMessages(inputMessages);

		// Check usage limits
		const { entitlements } = await enforceScribeUsageLimit({
			db: context.db,
			entitlements: context.entitlements.scribe,
			session: context.session,
		});

		// Validate input
		const hasAudio = audioFiles.length > 0;
		const hasContextFiles = contextFiles.length > 0;
		const rawPrompt = parsePromptPayload(prompt);
		if (!(hasAudio || hasContextFiles || hasNonEmptyInput(rawPrompt))) {
			throw new ORPCError("BAD_REQUEST", {
				message: USER_MESSAGES.missingInput,
			});
		}

		const hasFileInput = hasFileLikeInput(rawPrompt);
		const resolvedRequest =
			input.source === "customForm"
				? await resolveCustomFormRequest({
						db: context.db,
						formData: rawPrompt,
						formId: input.formId,
						sessionUser: context.session.user,
					})
				: await resolveBuiltInRequest({
						documentType: input.documentType,
						formData: rawPrompt,
						sessionUser: context.session.user,
					});

		const generationStrategy = await resolveGenerationStrategy(context.db, {
			hasAudio,
			hasFiles: hasFileInput || hasContextFiles,
		});
		const generationSelection = generationStrategy.generation;

		let messages: ModelMessage[] = resolvedRequest.promptMessages;

		messages = await appendScribeInputAttachmentsToMessages({
			audioFiles,
			contextFiles,
			generationStrategy,
			messages,
			userId: context.session.user.id,
			zdr: entitlements.hasActiveSubscription,
		});

		const usageInputData =
			hasContextFiles && !("_contextFiles" in rawPrompt)
				? {
						...rawPrompt,
						_contextFiles: summarizeContextFilesForUsage(contextFiles),
					}
				: rawPrompt;

		// Build provider options — only include OpenRouter-specific options when using OpenRouter
		const reasoningEffort = resolveReasoningEffort(
			resolvedRequest.config.modelConfig,
			generationSelection,
		);
		const thinkingEnabled = Boolean(
			generationSelection.model.isOpenRouter &&
			generationSelection.model.supportsReasoning &&
			reasoningEffort !== "none",
		);
		const providerOptions = buildProviderOptions({
			includeUsage: true,
			model: generationSelection.model,
			reasoningEffort,
			userId: context.session.user.id,
			zdr: entitlements.hasActiveSubscription,
		});

		// Stream the response
		const requestStartedAt = Date.now();
		let firstTokenAt: number | undefined;

		const result = streamText({
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
					modelConfig: resolvedRequest.config.modelConfig,
					modelName: generationSelection.model.modelName,
					promptLabel: resolvedRequest.config.promptLabel,
					promptName: resolvedRequest.config.promptName,
					reasoningEffort:
						generationSelection.model.isOpenRouter && generationSelection.model.supportsReasoning
							? reasoningEffort
							: undefined,
					thinkingEnabled,
					timing: {
						timeToCompletionMs: completedAt - requestStartedAt,
						timeToFirstTokenMs:
							firstTokenAt === undefined ? undefined : firstTokenAt - requestStartedAt,
					},
					usageMetadata: resolvedRequest.usageMetadata,
					userId: context.session.user.id,
				});
			},
			providerOptions,
			temperature: resolvedRequest.config.modelConfig.temperature ?? 1,
		});

		return streamToEventIterator(result.toUIMessageStream());
	});
