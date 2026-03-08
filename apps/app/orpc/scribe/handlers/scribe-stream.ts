import { ORPCError, streamToEventIterator, type } from "@orpc/server";
import {
	and,
	aiScribeFormConfig,
	eq,
	inArray,
	subscription,
	type Database,
	usageEvent,
} from "@repo/database";
import { streamText } from "ai";
import type { ModelMessage, UIMessage } from "ai";
import { after } from "next/server";

import { buildUsageEventData, extractOpenRouterUsage } from "@/lib/usage-logging";
import type { StandardUsage, UsageInputData, UsageMetadata } from "@/lib/usage-logging";
import { USER_MESSAGES } from "@/lib/user-messages";
import { authed } from "@/orpc";

import { getUsage } from "../_lib/get-usage";
import { composeScribeContext, type ContextBuildInput, type TemplateContextInput } from "../context";
import {
	buildSelectedTemplateReference,
	composeDocumentTypePrompt,
	composePromptHarnessPrompt,
	documentTypeConfigs,
	findRelevantTemplateForProcedure,
	injectCustomTemplateInstruction,
	resolveCustomModelConfig,
} from "../prompts";
import { resolveModel, resolveModelByRecordId } from "../providers";
import type { AudioFile, DocumentType, ModelConfig, PromptMessage } from "../types";

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

const hasAnyInput = (payload: Record<string, unknown>): boolean => {
	for (const entry of Object.values(payload)) {
		if (hasNonEmptyInput(entry)) {
			return true;
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

const scheduleAfter = (callback: () => Promise<void>): void => {
	const run = async () => {
		try {
			await callback();
		} catch (error) {
			// Usage logging should never break request handling or tests.
			console.error("Deferred usage logging failed:", error);
		}
	};

	try {
		after(run);
	} catch {
		// Fallback for non-request contexts (e.g. direct handler unit tests).
		void run();
	}
};

/**
 * Check subscription and usage limits
 */
const checkUsageLimit = async (
	userId: string,
	session: { user: { id: string } },
	db: Database,
) => {
	const subscriptions = await db
		.select()
		.from(subscription)
		.where(
			and(
				eq(subscription.referenceId, userId),
				inArray(subscription.status, ["active", "trialing"]),
			),
		);

	const activeSubscription = subscriptions.length > 0;
	const { usage } = await getUsage(session, db);
	const usageLimit = activeSubscription ? 500 : 50;

	if (usage.count >= usageLimit) {
		throw new ORPCError("FORBIDDEN", {
			message: USER_MESSAGES.usageLimitReached,
		});
	}

	return { activeSubscription, usage };
};

const assertResolvedModelSupportsInputs = (
	resolved: Awaited<ReturnType<typeof resolveModelByRecordId>>,
	options: { requireAudio?: boolean; requireFiles?: boolean },
) => {
	if (options.requireAudio && !resolved.inputModes.includes("audio")) {
		throw new ORPCError("BAD_REQUEST", {
			message: USER_MESSAGES.audioNotSupported,
		});
	}

	if (
		options.requireFiles &&
		!resolved.inputModes.includes("file") &&
		!resolved.inputModes.includes("image")
	) {
		throw new ORPCError("BAD_REQUEST", {
			message: USER_MESSAGES.filesNotSupported,
		});
	}
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
	examples: Array<{ content: string }>;
	title: string;
}): TemplateContextInput => ({
	content: template.content,
	examples: template.examples.map((example) => example.content),
	title: template.title,
});

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

	const { contextXml, patientContext } = await composeScribeContext({
		formData,
		sessionUser,
	});

	const relevantTemplate = documentType === "procedures"
		? await findRelevantTemplateForProcedure(patientContext.notes)
		: undefined;

	return {
		config,
		endpoint: documentType,
		promptMessages: composeDocumentTypePrompt(documentType, {
			contextXml,
			relevantTemplate,
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
			template: {
				with: {
					examples: true,
				},
			},
		},
	});

	if (!customForm || !customForm.enabled) {
		throw new ORPCError("NOT_FOUND", {
			message: "AI Form wurde nicht gefunden",
		});
	}

	const template = customForm.template ? toTemplateContextInput(customForm.template) : null;
	const { contextXml, patientContext } = await composeScribeContext({
		formData,
		sessionUser,
		template,
	});

	const relevantTemplate = customForm.template
		? buildSelectedTemplateReference(customForm.template)
		: customForm.promptHarness === "Procedure_chat"
			? await findRelevantTemplateForProcedure(patientContext.notes)
			: undefined;

	const promptMessages = composePromptHarnessPrompt(customForm.promptHarness, {
		contextXml,
		relevantTemplate,
	});
	if (!promptMessages) {
		throw new ORPCError("BAD_REQUEST", {
			message: `Unknown prompt harness: ${customForm.promptHarness}`,
		});
	}

	return {
		config: {
			modelConfig: resolveCustomModelConfig(customForm),
			promptName: customForm.promptHarness,
		},
		endpoint: `custom:${customForm.slug}`,
		modelId: customForm.modelId,
		promptMessages: injectCustomTemplateInstruction(
			promptMessages,
			Boolean(customForm.template),
		),
	};
};

/**
 * Main streaming handler for all scribe document types
 */
export const scribeStreamHandler = authed
	.input(type<ScribeStreamInput>())
	.handler(async ({ input, context }) => {
		const inputMessages = input.messages;
		const audioFiles = input.audioFiles;

		// Extract prompt from the last user message
		const prompt = extractPromptFromMessages(inputMessages);

		// Check usage limits
		const { activeSubscription } = await checkUsageLimit(
			context.session.user.id,
			context.session,
			context.db,
		);

		// Validate input
		const hasAudio = audioFiles && audioFiles.length > 0;
		const rawPrompt = parsePromptPayload(prompt);
		if (!hasAudio && !hasAnyInput(rawPrompt)) {
			throw new ORPCError("BAD_REQUEST", {
				message: USER_MESSAGES.missingInput,
			});
		}

		const hasFileInput = hasFileLikeInput(rawPrompt);
		const resolvedRequest = input.source === "customForm"
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

		if (resolvedRequest.modelId) {
			assertResolvedModelSupportsInputs(resolved, {
				requireAudio: hasAudio,
				requireFiles: hasFileInput,
			});
		}

		let messages: ModelMessage[] = resolvedRequest.promptMessages;

		// Handle audio files — capability validated by resolveModel
		if (hasAudio && audioFiles && resolved.inputModes.includes("audio")) {
			const lastMessage = messages.at(-1);
			if (lastMessage?.role === "user") {
				const audioContent = audioFiles.map((audioFile) => ({
					data: audioFile.data,
					mediaType: audioFile.mimeType,
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
						...(activeSubscription && { zdr: true }),
					},
				}
			: undefined;

		// Stream the response
		const result = streamText({
			maxOutputTokens: resolvedRequest.config.modelConfig.maxTokens ?? 20_000,
			messages,
			model: resolved.model,
			onFinish: (event) => {
				// PERF: Use after() for non-blocking usage logging (faster stream completion)
				scheduleAfter(async () => {
					// Extract OpenRouter usage data (graceful fallback for non-OpenRouter)
					const openRouterUsage = resolved.isOpenRouter
						? extractOpenRouterUsage(event.providerMetadata)
						: undefined;
					// Log usage to database using Drizzle
					// Plus subscribers: skip content logging for privacy (ZDR)
					await context.db.insert(usageEvent).values(
						buildUsageEventData({
							inputData: activeSubscription ? undefined : (rawPrompt as UsageInputData),
							metadata: {
								endpoint: resolvedRequest.endpoint,
								modelConfig: {
									maxTokens: resolvedRequest.config.modelConfig.maxTokens,
									temperature: resolvedRequest.config.modelConfig.temperature,
								},
								promptName: resolvedRequest.config.promptName,
								promptSource: "local",
								streamingMode: true,
								thinkingBudget: thinkingEnabled
									? resolvedRequest.config.modelConfig.thinkingBudget
									: undefined,
								thinkingEnabled,
								zdrEnabled: activeSubscription,
							} as UsageMetadata,
							model: resolved.modelName,
							name: "ai_scribe_generation",
							openRouterUsage,
							reasoning: activeSubscription ? "[zdr - content redacted]" : event.reasoningText,
							result: activeSubscription ? "[zdr - content redacted]" : event.text,
							standardUsage: event.usage as StandardUsage,
							userId: context.session.user.id,
						}),
					);
				});
			},
			providerOptions,
			temperature: resolvedRequest.config.modelConfig.temperature ?? 1,
		});

		return streamToEventIterator(result.toUIMessageStream());
	});
