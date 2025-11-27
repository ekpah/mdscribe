import { anthropic } from "@ai-sdk/anthropic";
import { streamToEventIterator, type } from "@orpc/server";
import { env } from "@repo/env";
import { streamText, type UIMessage } from "ai";
import Langfuse from "langfuse";
import { authed } from "@/orpc";

const langfuse = new Langfuse();

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
		const promptMessages = chatPrompt.compile(
			//variables
			{ ...promptVariables },
			//placeholders
		);
		console.log("promptMessages", promptMessages);
		console.log("input.body", input.body);
		const result = streamText({
			model: anthropic("claude-sonnet-4-20250514"),
			providerOptions: {
				anthropic: {
					thinking: { type: "enabled", budgetTokens: 12_000 },
				},
			},
			maxOutputTokens: 20_000,
			temperature: 0.3,
			messages: promptMessages,
			onFinish: async (event) => {
				// Log usage in development
				if (env.NODE_ENV === "development") {
					const logData = {
						promptTokens: event.usage.inputTokens,
						completionTokens: event.usage.outputTokens,
						totalTokens: event.usage.totalTokens,
						userId: context.session.user.id || "unknown",
						promptName: "ai_scribe_template_completion",
						thinking: event.reasoning,
						result: event.text,
					};
					console.log(logData);
				}

				// Log tokens to the postgres database for usage tracking
				await context.db.usageEvent.create({
					data: {
						userId: context.session.user.id || "",
						totalTokens: event.usage.totalTokens,
						name: "ai_scribe_generation",
					},
				});
			},
		});

		return streamToEventIterator(result.toUIMessageStream());
	});
