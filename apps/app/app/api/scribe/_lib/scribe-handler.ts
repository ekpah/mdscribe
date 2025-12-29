/**
 * Reusable API handler for scribe routes
 *
 * This module provides a reusable handler that abstracts common functionality
 * for all scribe API routes, including:
 * - Authentication and subscription checking
 * - Input validation and processing
 * - Langfuse prompt integration
 * - AI model configuration and streaming response generation
 * - Claude thinking mode configuration (disabled by default)
 * - Usage logging and telemetry
 * - Error handling
 *
 * @example
 * const handleAnamnese = createScribeHandler({
 *   promptName: 'ER_Anamnese_chat',
 *   validateInput: createInputValidator(['prompt']),
 *   processInput: (input) => {
 *     const { prompt } = input as { prompt: string };
 *     const parsed = JSON.parse(prompt);
 *     return { anamnese: parsed.anamnese, vordiagnosen: parsed.vordiagnosen };
 *   },
 *   modelConfig: {
 *     thinking: true, // Enable thinking (default: false)
 *     thinkingBudget: 8000,
 *   },
 * });
 *
 * @example
 * // Usage in API route:
 * export const POST = handleAnamnese;
 */

import type { AnthropicProviderOptions } from "@ai-sdk/anthropic";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { database } from "@repo/database";
import { env } from "@repo/env";
import { type LanguageModel, type ModelMessage, streamText } from "ai";
import { Langfuse } from "langfuse";
import { headers } from "next/headers";
import { auth } from "@/auth";
import type { Session } from "@/lib/auth-types";
import {
	buildUsageEventData,
	extractOpenRouterUsage,
	type StandardUsage,
	type UsageInputData,
	type UsageMetadata,
} from "@/lib/usage-logging";
import { getUsage } from "./get-usage";

const langfuse = new Langfuse();

// Supported models type
type SupportedModel =
	| "glm-4p6"
	| "claude-opus-4.5"
	| "gemini-3-pro"
	| "gemini-3-flash";

// Model configuration mapper
function getModelConfig(modelId: string): {
	model: LanguageModel;
	supportsThinking: boolean;
} {
	const openrouter = createOpenRouter({
		apiKey: env.OPENROUTER_API_KEY as string,
	});
	switch (modelId as SupportedModel) {
		case "glm-4p6":
			return {
				model: openrouter("z-ai/glm-4.6"),
				supportsThinking: true,
			};
		case "claude-opus-4.5":
			return {
				model: openrouter("anthropic/claude-opus-4.5"),
				supportsThinking: true,
			};
		case "gemini-3-pro":
			return {
				model: openrouter("google/gemini-3-pro-preview"),
				supportsThinking: true,
			};
		case "gemini-3-flash":
			return {
				model: openrouter("google/gemini-3-flash-preview"),
				supportsThinking: true,
			};
		default:
			// Default to Claude if unknown model
			return {
				model: openrouter("anthropic/claude-opus-4.5"),
				supportsThinking: true,
			};
	}
}

interface ScribeHandlerConfig {
	// Langfuse prompt configuration
	promptName: string;
	promptLabel?: string;

	// Input validation and processing
	validateInput: (input: unknown) => { isValid: boolean; error?: string };
	processInput: (
		input: unknown,
	) => Record<string, unknown> | Promise<Record<string, unknown>>;

	// AI model configuration
	modelConfig?: {
		maxTokens?: number;
		temperature?: number;
		thinking?: boolean; // Default: false
		thinkingBudget?: number;
	};

	// Custom metadata for telemetry
	getMetadata?: (
		input: unknown,
		userId: string,
	) => Record<string, string | number | boolean>;
}

async function checkAuthAndSubscription() {
	const session = await auth.api.getSession({
		headers: await headers(),
	});
	if (!session) {
		return new Response("Unauthorized", { status: 401 });
	}

	// Query subscriptions directly from database (client-side authClient doesn't work server-side)
	const subscriptions = await auth.api.listActiveSubscriptions({
		query: {
			referenceId: session.user.id,
		},
		// This endpoint requires session cookies.
		headers: await headers(),
	});

	const activeSubscription = subscriptions.find(
		(sub) => sub.status === "active" || sub.status === "trialing",
	);

	const { usage } = await getUsage(session as Session);

	const usageLimit = activeSubscription ? 500 : 50;

	if (usage?.count >= usageLimit) {
		return new Response(
			"Monatliche Nutzungsgrenze erreicht - passe dein Abonnement an",
			{ status: 403 },
		);
	}

	return { session, activeSubscription, usage };
}

async function getLangfusePrompt(promptName: string, promptLabel?: string) {
	const textPrompt = await langfuse.getPrompt(promptName, undefined, {
		type: "chat",
		label:
			promptLabel || (env.NODE_ENV === "production" ? "production" : "staging"),
	});

	return textPrompt;
}

async function processRequest(
	config: ScribeHandlerConfig,
	requestBody: unknown,
) {
	// Validate input
	const validation = config.validateInput(requestBody);
	if (!validation.isValid) {
		return { error: validation.error || "Invalid input", status: 400 };
	}

	// Extract model and audio files from request body (default to claude-opus-4.5)
	const requestObj = requestBody as Record<string, unknown>;
	const model = requestObj.model as string;
	const audioFiles = requestObj.audioFiles as
		| Array<{ data: string; mimeType: string }>
		| undefined;

	// Process input data
	const processedInput = await config.processInput(requestBody);

	// Get today's date for prompt compilation
	const todaysDate = new Date().toLocaleDateString("de-DE", {
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
	});
	return { processedInput, todaysDate, model, audioFiles };
}

async function generateResponse(
	config: ScribeHandlerConfig,
	messages: ModelMessage[],
	metadata: Record<string, string | number | boolean>,
	session: Session,
	modelId: string,
	processedInput: Record<string, unknown>,
	audioFiles?: Array<{ data: string; mimeType: string }>,
) {
	// Default model configuration
	const defaultModelConfig = {
		maxTokens: 20_000,
		temperature: 1,
		thinking: false, // Default: false
		thinkingBudget: 8000,
	};

	const modelConfig = { ...defaultModelConfig, ...config.modelConfig };

	// Get the model and its capabilities
	const { model, supportsThinking } = getModelConfig(modelId);

	// Build provider options conditionally (only for models that support thinking)
	const providerOptions: AnthropicProviderOptions = {};
	if (modelConfig.thinking && supportsThinking) {
		providerOptions.thinking = {
			type: "enabled",
			budgetTokens: modelConfig.thinkingBudget,
		};
	}

	// If audio files are provided, add them to the messages
	// Vercel AI SDK expects FilePart: { type: 'file', data: base64 | dataUrl, mimeType: string }
	let messagesWithAudio: ModelMessage[] = messages;
	if (audioFiles && audioFiles.length > 0 && modelId.startsWith("gemini")) {
		// Add audio files to the user message
		const lastMessage = messages.at(-1);
		if (lastMessage?.role === "user") {
			// Transform audio files to Vercel AI SDK's FilePart format
			// also transform to an openrouter compatbible format: MP3 and WAV
			// MP3: "audio/mpeg" or "audio/mp3"
			// WAV: "audio/wav" or "audio/x-wav"
			const audioContent = audioFiles.map((audioFile) => ({
				type: "file" as const,
				data: audioFile.data,
				mediaType: audioFile.mimeType,
			}));

			messagesWithAudio = [
				...messages.slice(0, -1),
				{
					...lastMessage,
					content: [
						{
							type: "text" as const,
							text:
								typeof lastMessage.content === "string"
									? lastMessage.content
									: "",
						},
						...audioContent,
					],
				},
			];
		}
		console.log("messagesWithAudio", messagesWithAudio);
	}

	// Create streaming response
	const result = streamText({
		model,
		maxOutputTokens: modelConfig.maxTokens,
		temperature: modelConfig.temperature,
		providerOptions: {
			openrouter: { usage: { include: true }, user: session?.user?.email },
		},
		messages: messagesWithAudio,
		onFinish: async (event) => {
			// Extract OpenRouter usage data (includes cost)
			const openRouterUsage = extractOpenRouterUsage(event.providerMetadata);

			// Log comprehensive usage data to postgres
			const createdUsageEvent = await database.usageEvent.create({
				data: buildUsageEventData({
					userId: session?.user?.id || "",
					name: "ai_scribe_generation",
					model: modelId,
					openRouterUsage,
					standardUsage: event.usage as StandardUsage,
					inputData: processedInput as UsageInputData,
					metadata: {
						promptName: config.promptName,
						promptLabel: config.promptLabel,
						thinkingEnabled: modelConfig.thinking,
						thinkingBudget: modelConfig.thinking
							? modelConfig.thinkingBudget
							: undefined,
						modelConfig: {
							maxTokens: modelConfig.maxTokens,
							temperature: modelConfig.temperature,
						},
					} as UsageMetadata,
					result: event.text,
					reasoning: event.reasoningText,
				}),
			});

			// Log created usage event in development
			if (env.NODE_ENV === "development") {
				console.log("Created usage event:", createdUsageEvent);
			}
		},
	});

	return result.toUIMessageStreamResponse();
}

export function createScribeHandler(
	config: ScribeHandlerConfig,
): (req: Request) => Promise<Response> {
	return async (req: Request): Promise<Response> => {
		try {
			// Get session and subscription
			const authResult = await checkAuthAndSubscription();
			if (authResult instanceof Response) {
				return authResult;
			}
			const { session } = authResult;

			// Parse request body
			const requestBody = await req.json();

			// Process request
			const processed = await processRequest(config, requestBody);
			if ("error" in processed) {
				return new Response(processed.error, { status: processed.status });
			}

			// Check authentication and subscription - allow for every logged in user for now
			const allowAIUseFlag = !!session?.user;
			if (!allowAIUseFlag) {
				return new Response(
					"Unauthorized: Du brauchst ein aktives Abo um diese Funktion zu nutzen.",
					{ status: 401 },
				);
			}

			if (!session?.user?.stripeCustomerId) {
				return new Response(
					"Unauthorized: Du musst einen Stripe Account haben um diese Funktion zu nutzen.",
					{ status: 401 },
				);
			}

			// Get Langfuse prompt
			const textPrompt = await getLangfusePrompt(
				config.promptName,
				config.promptLabel,
			);

			// Compile prompt with processed input and today's date
			const compiledPrompt = textPrompt.compile({
				...processed.processedInput,
				todaysDate: processed.todaysDate,
			});

			const messages: ModelMessage[] = compiledPrompt;

			// Prepare base metadata
			const baseMetadata: Record<string, string | number | boolean> = {
				userId: session?.user?.id || "unknown",
				promptName: config.promptName,
				...processed.processedInput,
			};

			// Add custom metadata if provided
			const customMetadata = config.getMetadata?.(
				requestBody,
				session?.user?.id || "unknown",
			);
			const metadata = { ...baseMetadata, ...customMetadata };

			// Generate response with selected model
			return await generateResponse(
				config,
				messages,
				metadata,
				session,
				processed.model,
				processed.processedInput,
				processed.audioFiles,
			);
		} catch (error) {
			// Handle errors gracefully
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error occurred";
			return new Response(`Internal server error: ${errorMessage}`, {
				status: 500,
			});
		}
	};
}

// Helper function to create common input validators
export const createInputValidator = (requiredFields: string[]) => {
	return (input: unknown): { isValid: boolean; error?: string } => {
		if (!input || typeof input !== "object") {
			return { isValid: false, error: "Invalid input format" };
		}

		const inputObj = input as Record<string, unknown>;

		for (const field of requiredFields) {
			if (
				!inputObj[field] ||
				(typeof inputObj[field] === "string" &&
					!inputObj[field].toString().trim())
			) {
				return {
					isValid: false,
					error: `Missing or empty required field: ${field}`,
				};
			}
		}

		return { isValid: true };
	};
};
