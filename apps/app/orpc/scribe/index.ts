import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { streamToEventIterator, type } from "@orpc/server";
import { env } from "@repo/env";
import { streamText, type UIMessage } from "ai";
import Langfuse from "langfuse";
import {
	buildUsageEventData,
	extractOpenRouterUsage,
	type StandardUsage,
	type UsageInputData,
	type UsageMetadata,
} from "@/lib/usage-logging";
import { authed } from "@/orpc";

// Re-export the unified scribe stream handler for document generation
export { scribeStreamHandler } from "./handlers";

const langfuse = new Langfuse();
const openrouter = createOpenRouter({
	apiKey: env.OPENROUTER_API_KEY as string,
});

const MODEL_ID = "anthropic/claude-sonnet-4-20250514";

/**
 * Template completion handler for the chat-based template editor
 * This is a separate use case from the document generation endpoints
 */
export const scribeHandler = authed
	.input(type<{ chatId: string; messages: UIMessage[]; body?: object }>())
	.handler(async ({ input, context }) => {
		// Get today's date for prompt compilation
		const todaysDate = new Date().toLocaleDateString("de-DE", {
			day: "2-digit",
			month: "2-digit",
			year: "numeric",
		});

		const chatPrompt = await langfuse.getPrompt(
			"ai_scribe_template_completion",
			undefined,
			{
				type: "chat",
				label: env.NODE_ENV === "production" ? "production" : "staging",
			},
		);
		const promptVariables = {
			todaysDate,
			...input.body,
		};
		const promptMessages = chatPrompt.compile({ ...promptVariables });

		const result = streamText({
			model: openrouter(MODEL_ID),
			providerOptions: {
				openrouter: {
					usage: { include: true },
					user: context.session.user.email,
				},
			},
			maxOutputTokens: 20_000,
			temperature: 0.3,
			messages: promptMessages,
			onFinish: async (event) => {
				const openRouterUsage = extractOpenRouterUsage(event.providerMetadata);

				await context.db.usageEvent.create({
					data: buildUsageEventData({
						userId: context.session.user.id || "",
						name: "ai_scribe_generation",
						model: MODEL_ID,
						openRouterUsage,
						standardUsage: event.usage as StandardUsage,
						inputData: (input.body ?? {}) as UsageInputData,
						metadata: {
							promptName: "ai_scribe_template_completion",
							promptLabel:
								env.NODE_ENV === "production" ? "production" : "staging",
							thinkingEnabled: false,
							streamingMode: true,
						} as UsageMetadata,
						result: event.text,
						reasoning: event.reasoning,
					}),
				});
			},
		});

		return streamToEventIterator(result.toUIMessageStream());
	});
