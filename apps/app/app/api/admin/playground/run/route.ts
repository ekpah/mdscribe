import type { AnthropicProviderOptions } from "@ai-sdk/anthropic";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { database } from "@repo/database";
import { env } from "@repo/env";
import { type ModelMessage, streamText } from "ai";
import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/auth";
import { allowAdminAccess } from "@/flags";
import {
	buildUsageEventData,
	extractOpenRouterUsage,
	type StandardUsage,
} from "@/lib/usage-logging";

const PlaygroundRequestSchema = z.object({
	model: z.string(),
	messages: z.array(
		z.object({
			role: z.enum(["system", "user", "assistant"]),
			content: z.string(),
		}),
	),
	parameters: z.object({
		temperature: z.number().min(0).max(2).optional().default(1),
		maxTokens: z.number().min(1).max(100000).optional().default(4096),
		thinking: z.boolean().optional().default(false),
		thinkingBudget: z.number().min(1000).max(50000).optional().default(8000),
		topP: z.number().min(0).max(1).optional(),
		topK: z.number().min(0).optional(),
		frequencyPenalty: z.number().min(-2).max(2).optional(),
		presencePenalty: z.number().min(-2).max(2).optional(),
	}),
	// Multimodal inputs
	audioFiles: z
		.array(
			z.object({
				data: z.string(),
				mimeType: z.string(),
			}),
		)
		.optional(),
	imageFiles: z
		.array(
			z.object({
				data: z.string(),
				mimeType: z.string(),
			}),
		)
		.optional(),
	documentFiles: z
		.array(
			z.object({
				data: z.string(),
				mimeType: z.string(),
				filename: z.string().optional(),
			}),
		)
		.optional(),
});

export type PlaygroundRequest = z.infer<typeof PlaygroundRequestSchema>;

export async function POST(req: Request) {
	// Check authentication
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	if (!session) {
		return new Response("Unauthorized", { status: 401 });
	}

	// Check admin access
	const hasAdminAccess = await allowAdminAccess();
	if (!hasAdminAccess) {
		return new Response("Forbidden", { status: 403 });
	}

	try {
		const body = await req.json();
		const validated = PlaygroundRequestSchema.parse(body);

		const openrouter = createOpenRouter({
			apiKey: env.OPENROUTER_API_KEY as string,
		});

		const model = openrouter(validated.model);
		const startTime = Date.now();

		// Check if model supports thinking (Claude models primarily)
		const supportsThinking =
			validated.model.includes("claude") ||
			validated.model.includes("glm") ||
			validated.model.includes("gemini");

		// Build provider options
		const providerOptions: AnthropicProviderOptions = {};
		if (validated.parameters.thinking && supportsThinking) {
			providerOptions.thinking = {
				type: "enabled",
				budgetTokens: validated.parameters.thinkingBudget,
			};
		}

		// Process messages to include multimodal content
		let processedMessages: ModelMessage[] = validated.messages.map((msg) => ({
			role: msg.role,
			content: msg.content,
		}));

		// Add multimodal content to the last user message
		const lastUserMessageIndex = processedMessages.findLastIndex(
			(m) => m.role === "user",
		);

		if (lastUserMessageIndex !== -1) {
			const lastUserMessage = processedMessages[lastUserMessageIndex];
			const contentParts: Array<
				| { type: "text"; text: string }
				| { type: "image"; image: string; mimeType?: string }
				| { type: "file"; data: string; mediaType: string }
			> = [];

			// Add text content
			if (
				typeof lastUserMessage.content === "string" &&
				lastUserMessage.content
			) {
				contentParts.push({ type: "text", text: lastUserMessage.content });
			}

			// Add image files
			if (validated.imageFiles && validated.imageFiles.length > 0) {
				for (const img of validated.imageFiles) {
					contentParts.push({
						type: "image",
						image: img.data,
						mimeType: img.mimeType,
					});
				}
			}

			// Add audio files (for models that support it)
			if (validated.audioFiles && validated.audioFiles.length > 0) {
				for (const audio of validated.audioFiles) {
					contentParts.push({
						type: "file",
						data: audio.data,
						mediaType: audio.mimeType,
					});
				}
			}

			// Add document files
			if (validated.documentFiles && validated.documentFiles.length > 0) {
				for (const doc of validated.documentFiles) {
					contentParts.push({
						type: "file",
						data: doc.data,
						mediaType: doc.mimeType,
					});
				}
			}

			// Update message if there are multimodal parts
			if (contentParts.length > 1 || contentParts.length === 0) {
				processedMessages = [
					...processedMessages.slice(0, lastUserMessageIndex),
					{
						...lastUserMessage,
						content:
							contentParts.length > 0
								? contentParts
								: lastUserMessage.content,
					},
					...processedMessages.slice(lastUserMessageIndex + 1),
				];
			}
		}

		// Create streaming response
		const result = streamText({
			model,
			maxOutputTokens: validated.parameters.maxTokens,
			temperature: validated.parameters.temperature,
			topP: validated.parameters.topP,
			topK: validated.parameters.topK,
			frequencyPenalty: validated.parameters.frequencyPenalty,
			presencePenalty: validated.parameters.presencePenalty,
			providerOptions: {
				openrouter: { usage: { include: true }, user: session?.user?.email },
				...(Object.keys(providerOptions).length > 0
					? { anthropic: providerOptions }
					: {}),
			},
			messages: processedMessages,
			onFinish: async (event) => {
				const endTime = Date.now();
				const latencyMs = endTime - startTime;

				// Extract OpenRouter usage data
				const openRouterUsage = extractOpenRouterUsage(event.providerMetadata);

				// Log usage event
				await database.usageEvent.create({
					data: buildUsageEventData({
						userId: session?.user?.id || "",
						name: "admin_playground",
						model: validated.model,
						openRouterUsage,
						standardUsage: event.usage as StandardUsage,
						inputData: {
							messages: validated.messages,
							hasAudio: (validated.audioFiles?.length ?? 0) > 0,
							hasImages: (validated.imageFiles?.length ?? 0) > 0,
							hasDocuments: (validated.documentFiles?.length ?? 0) > 0,
						},
						metadata: {
							promptName: "admin_playground",
							thinkingEnabled: validated.parameters.thinking,
							thinkingBudget: validated.parameters.thinking
								? validated.parameters.thinkingBudget
								: undefined,
							latencyMs,
							modelConfig: {
								maxTokens: validated.parameters.maxTokens,
								temperature: validated.parameters.temperature,
								topP: validated.parameters.topP,
								topK: validated.parameters.topK,
								frequencyPenalty: validated.parameters.frequencyPenalty,
								presencePenalty: validated.parameters.presencePenalty,
							},
						},
						result: event.text,
						reasoning: event.reasoningText,
					}),
				});
			},
		});

		// Return streaming response with custom headers for metrics
		const response = result.toUIMessageStreamResponse();

		// Add timing header
		response.headers.set("X-Request-Start-Time", startTime.toString());

		return response;
	} catch (error) {
		console.error("Playground error:", error);

		if (error instanceof z.ZodError) {
			return new Response(
				JSON.stringify({
					error: "Validation error",
					details: error.errors,
				}),
				{ status: 400, headers: { "Content-Type": "application/json" } },
			);
		}

		return new Response(
			`Error: ${error instanceof Error ? error.message : "Unknown error"}`,
			{ status: 500 },
		);
	}
}
