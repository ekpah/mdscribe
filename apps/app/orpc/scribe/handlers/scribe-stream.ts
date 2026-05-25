import { ORPCError, streamToEventIterator, type } from "@orpc/server";
import { aiScribeFormConfig, eq } from "@repo/database";
import type { Database } from "@repo/database";
import { streamText } from "ai";
import type { ModelMessage, UIMessage } from "ai";

import { USER_MESSAGES } from "@/lib/user-messages";
import { authed } from "@/orpc";
import { scribeEntitlementsMiddleware } from "@/orpc/middlewares/entitlements";
import { composeScribeContext, findRelevantTemplateForProcedure } from "@/orpc/scribe/context";
import type { ContextBuildInput, TemplateContextInput } from "@/orpc/scribe/context";
import { getAudioMediaType } from "@/orpc/scribe/handlers/audio-media-type";
import { enforceScribeUsageLimit } from "@/orpc/scribe/handlers/usage-limit";
import { scheduleScribeUsageLogging } from "@/orpc/scribe/handlers/usage-logging";
import {
	composeDocumentTypePrompt,
	composePromptHarnessPrompt,
	documentTypeConfigs,
} from "@/orpc/scribe/prompts";
import { resolveModel, resolveModelByRecordId } from "@/orpc/scribe/providers";
import type { AudioFile, DocumentType, ModelConfig, PromptMessage } from "@/orpc/scribe/types";

export const DEFAULT_SCRIBE_MODEL_CONFIG: ModelConfig = {
	maxTokens: 8_000,
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

/**
 * Scribe input type - uses UIMessage[] for AI SDK useChat compatibility
 */
interface BuiltInScribeStreamInput {
	documentType: DocumentType;
	messages: UIMessage[];
	audioFiles?: AudioFile[];
	source?: "documentType";
}

interface CustomFormScribeStreamInput {
	formId: string;
	messages: UIMessage[];
	audioFiles?: AudioFile[];
	source: "customForm";
}

type ScribeStreamInput = BuiltInScribeStreamInput | CustomFormScribeStreamInput;

interface ResolvedScribeRequest {
	config: {
		modelConfig: ModelConfig;
		promptName: string;
	};
	endpoint: string;
	modelId?: string | null;
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
			promptName: config.promptName,
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
	sessionUser: ContextBuildInput["sessionUser"];
}): Promise<ResolvedScribeRequest> => {
	const customForm = await db.query.aiScribeFormConfig.findFirst({
		where: eq(aiScribeFormConfig.id, formId),
		with: {
			template: true,
		},
	});

	if (!customForm || !customForm.enabled) {
		throw new ORPCError("NOT_FOUND", {
			message: "AI Form wurde nicht gefunden",
		});
	}

	const template = customForm.template ? toTemplateContextInput(customForm.template) : null;
	const selectedTemplateReference =
		customForm.promptHarness === "procedure" && !template
			? await findRelevantTemplateForProcedure(readTrimmedStringField(formData, "notes") ?? "")
			: undefined;
	const { contextPrompt, contextXml } = await composeScribeContext({
		formData,
		promptContextKey: customForm.promptHarness,
		selectedTemplateReference,
		sessionUser,
		template,
	});

	const promptMessages = composePromptHarnessPrompt(customForm.promptHarness, {
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
			promptName: customForm.promptHarness,
		},
		endpoint: `custom:${customForm.slug}`,
		modelId: customForm.modelId,
		promptMessages,
		usageMetadata: {
			customFormId: customForm.id,
			customFormSlug: customForm.slug,
			templateId: customForm.templateId,
		},
	};
};

/**
 * Main streaming handler for all scribe document types
 */
export const scribeStreamHandler = authed
	.use(scribeEntitlementsMiddleware)
	.input(type<ScribeStreamInput>())
	.handler(async ({ input, context }) => {
		const inputMessages = input.messages;
		const { audioFiles } = input;

		// Extract prompt from the last user message
		const prompt = extractPromptFromMessages(inputMessages);

		// Check usage limits
		const { entitlements } = await enforceScribeUsageLimit({
			db: context.db,
			entitlements: context.entitlements.scribe,
			session: context.session,
		});

		// Validate input
		const hasAudio = audioFiles && audioFiles.length > 0;
		const rawPrompt = parsePromptPayload(prompt);
		if (!hasAudio && !hasNonEmptyInput(rawPrompt)) {
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

		const resolved = resolvedRequest.modelId
			? await resolveModelByRecordId(resolvedRequest.modelId, context.db)
			: await resolveModel(context.db, {
					requireAudio: hasAudio,
					requireFiles: hasFileInput,
				});

		let messages: ModelMessage[] = resolvedRequest.promptMessages;

		// Handle audio files
		if (hasAudio && audioFiles) {
			const lastMessage = messages.at(-1);
			if (lastMessage?.role === "user") {
				const audioContent = audioFiles.map((audioFile) => ({
					data: audioFile.data,
					mediaType: getAudioMediaType(audioFile.mimeType, resolved.isOpenRouter),
					type: "file" as const,
				}));

				messages = [
					...messages.slice(0, -1),
					{
						...lastMessage,
						content: [
							{
								text: typeof lastMessage.content === "string" ? lastMessage.content : "",
								type: "text" as const,
							},
							...audioContent,
						],
					},
				];
			}
		}

		// Build provider options — only include OpenRouter-specific options when using OpenRouter
		const thinkingEnabled = Boolean(
			resolvedRequest.config.modelConfig.thinking && resolved.supportsReasoning,
		);

		// Enable with budget when desired, otherwise omit entirely.
		// NEVER send { enabled: false } — some models require mandatory reasoning.
		const reasoningConfig = thinkingEnabled
			? { max_tokens: resolvedRequest.config.modelConfig.thinkingBudget ?? 8000 }
			: undefined;

		const providerOptions = resolved.isOpenRouter
			? {
					openrouter: {
						usage: { include: true },
						user: context.session.user.email,
						...(reasoningConfig && { reasoning: reasoningConfig }),
						...(entitlements.hasActiveSubscription && { zdr: true }),
					},
				}
			: undefined;

		// Stream the response
		const requestStartedAt = Date.now();
		let firstTokenAt: number | undefined;

		const result = streamText({
			maxOutputTokens: resolvedRequest.config.modelConfig.maxTokens ?? 20_000,
			messages,
			model: resolved.model,
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
					inputData: rawPrompt,
					isOpenRouter: resolved.isOpenRouter,
					modelConfig: resolvedRequest.config.modelConfig,
					modelName: resolved.modelName,
					promptName: resolvedRequest.config.promptName,
					timing: {
						timeToCompletionMs: completedAt - requestStartedAt,
						timeToFirstTokenMs:
							firstTokenAt === undefined ? undefined : firstTokenAt - requestStartedAt,
					},
					usageMetadata: resolvedRequest.usageMetadata,
					thinkingEnabled,
					userId: context.session.user.id,
				});
			},
			providerOptions,
			temperature: resolvedRequest.config.modelConfig.temperature ?? 1,
		});

		return streamToEventIterator(result.toUIMessageStream());
	});
