import type { AnthropicProviderOptions } from "@ai-sdk/anthropic";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { ORPCError, streamToEventIterator, type } from "@orpc/server";
import { usageEvent } from "@repo/database";
import { env } from "@repo/env";
import { type ModelMessage, streamText } from "ai";
import { Langfuse } from "langfuse";
import { z } from "zod";

import {
	buildUsageEventData,
	extractOpenRouterUsage,
	type StandardUsage,
	type UsageInputData,
	type UsageMetadata,
} from "@/lib/usage-logging";
import { authed } from "@/orpc";
import { documentTypeConfigs } from "../scribe/config";
import { requiredAdminMiddleware } from "../middlewares/admin";

const langfuse = new Langfuse();

const promptLabelSchema = z.enum(["production", "staging"]).optional();

function defaultPromptLabel(): "production" | "staging" {
	return env.NODE_ENV === "production" ? "production" : "staging";
}

function todaysDateDE(): string {
	return new Date().toLocaleDateString("de-DE", {
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
	});
}

function langfuseAuthHeaders(): HeadersInit {
	const token = Buffer.from(
		`${env.LANGFUSE_PUBLIC_KEY}:${env.LANGFUSE_SECRET_KEY}`,
	).toString("base64");

	return {
		Authorization: `Basic ${token}`,
		"Content-Type": "application/json",
	};
}

const compilePromptInput = z.object({
	documentType: z.string(),
	promptName: z.string().optional(),
	promptLabel: promptLabelSchema,
	/**
	 * Preferred input: variables already shaped like `processedInput` in production.
	 */
	variables: z.record(z.unknown()).optional(),
	/**
	 * Convenience input: pass the raw prompt JSON (same as what AI Scribe sends),
	 * and we’ll run the production `processInput` server-side for parity.
	 */
	promptJson: z.string().optional(),
});

const compilePromptHandler = authed
	.use(requiredAdminMiddleware)
	.input(type<z.infer<typeof compilePromptInput>>())
	.handler(async ({ input }) => {
		const parsed = compilePromptInput.parse(input);
		const config =
			documentTypeConfigs[parsed.documentType as keyof typeof documentTypeConfigs];
		if (!config) {
			throw new ORPCError("BAD_REQUEST", {
				message: `Unknown document type: ${parsed.documentType}`,
			});
		}

		const resolvedPromptName = parsed.promptName ?? config.promptName;
		const resolvedPromptLabel = parsed.promptLabel ?? defaultPromptLabel();

		const variablesUsed =
			parsed.variables ??
			(parsed.promptJson ? config.processInput(parsed.promptJson) : {});

		const textPrompt = await langfuse.getPrompt(resolvedPromptName, undefined, {
			type: "chat",
			label: resolvedPromptLabel,
		});

		const compiledMessages = textPrompt.compile({
			...variablesUsed,
			todaysDate: todaysDateDE(),
		});

		return {
			compiledMessages,
			resolvedPromptName,
			resolvedPromptLabel,
			variablesUsed,
		};
	});

const runInput = z.object({
	requestId: z.string(),
	model: z.string(),
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
	documentType: z.string(),
	promptName: z.string().optional(),
	promptLabel: promptLabelSchema,
	variables: z.record(z.unknown()).optional(),
	promptJson: z.string().optional(),
	compiledMessagesOverride: z
		.array(
			z.object({
				role: z.enum(["system", "user", "assistant"]),
				content: z.union([z.string(), z.array(z.unknown())]),
			}),
		)
		.optional(),
});

const runHandler = authed
	.use(requiredAdminMiddleware)
	.input(type<z.infer<typeof runInput>>())
	.handler(async ({ input, context }) => {
		const parsed = runInput.parse(input);
		const config =
			documentTypeConfigs[parsed.documentType as keyof typeof documentTypeConfigs];
		if (!config) {
			throw new ORPCError("BAD_REQUEST", {
				message: `Unknown document type: ${parsed.documentType}`,
			});
		}

		const resolvedPromptName = parsed.promptName ?? config.promptName;
		const resolvedPromptLabel = parsed.promptLabel ?? defaultPromptLabel();

		const variablesUsed =
			parsed.variables ??
			(parsed.promptJson ? config.processInput(parsed.promptJson) : {});

		const openrouter = createOpenRouter({
			apiKey: env.OPENROUTER_API_KEY as string,
		});
		const model = openrouter(parsed.model);

		const supportsThinking =
			parsed.model.includes("claude") ||
			parsed.model.includes("glm") ||
			parsed.model.includes("gemini");

		const providerOptions: AnthropicProviderOptions = {};
		if (parsed.parameters.thinking && supportsThinking) {
			providerOptions.thinking = {
				type: "enabled",
				budgetTokens: parsed.parameters.thinkingBudget,
			};
		}

		let messages: ModelMessage[];
		if (parsed.compiledMessagesOverride) {
			messages = parsed.compiledMessagesOverride as unknown as ModelMessage[];
		} else {
			const textPrompt = await langfuse.getPrompt(resolvedPromptName, undefined, {
				type: "chat",
				label: resolvedPromptLabel,
			});
			messages = textPrompt.compile({
				...variablesUsed,
				todaysDate: todaysDateDE(),
			});
		}

		const startTime = Date.now();

		const result = streamText({
			model,
			maxOutputTokens: parsed.parameters.maxTokens,
			temperature: parsed.parameters.temperature,
			topP: parsed.parameters.topP,
			topK: parsed.parameters.topK,
			frequencyPenalty: parsed.parameters.frequencyPenalty,
			presencePenalty: parsed.parameters.presencePenalty,
			providerOptions: {
				openrouter: { usage: { include: true }, user: context.session.user.email },
				...(Object.keys(providerOptions).length > 0
					? { anthropic: providerOptions }
					: {}),
			},
			messages,
			onFinish: async (event) => {
				const latencyMs = Date.now() - startTime;
				const openRouterUsage = extractOpenRouterUsage(event.providerMetadata);

				await context.db.insert(usageEvent).values(
					buildUsageEventData({
						userId: context.session.user.id,
						name: "admin_scribe_playground",
						model: parsed.model,
						openRouterUsage,
						standardUsage: event.usage as StandardUsage,
						inputData: variablesUsed as UsageInputData,
						metadata: {
							requestId: parsed.requestId,
							promptName: resolvedPromptName,
							promptLabel: resolvedPromptLabel,
							thinkingEnabled: parsed.parameters.thinking,
							thinkingBudget: parsed.parameters.thinking
								? parsed.parameters.thinkingBudget
								: undefined,
							latencyMs,
							endpoint: parsed.documentType,
							modelConfig: {
								maxTokens: parsed.parameters.maxTokens,
								temperature: parsed.parameters.temperature,
								topP: parsed.parameters.topP,
								topK: parsed.parameters.topK,
								frequencyPenalty: parsed.parameters.frequencyPenalty,
								presencePenalty: parsed.parameters.presencePenalty,
							},
						} as UsageMetadata,
						result: event.text,
						reasoning: event.reasoningText,
					}),
				);
			},
		});

		return streamToEventIterator(result.toUIMessageStream());
	});

export const scribeHandler = {
	compilePrompt: compilePromptHandler,
	run: runHandler,
	prompts: {
		list: authed
			.use(requiredAdminMiddleware)
			.input(
				type<{
					query?: string;
					limit?: number;
				}>(),
			)
			.handler(async ({ input }) => {
				const limit = input.limit ?? 200;
				const url = new URL(
					"/api/public/v2/prompts",
					env.LANGFUSE_BASEURL as string,
				);
				url.searchParams.set("limit", String(limit));
				if (input.query && input.query.trim()) {
					url.searchParams.set("query", input.query.trim());
				}

				const res = await fetch(url, {
					method: "GET",
					headers: langfuseAuthHeaders(),
				});
				if (!res.ok) {
					throw new ORPCError("INTERNAL_SERVER_ERROR", {
						message: `Langfuse prompts list failed (${res.status})`,
					});
				}

				const data = (await res.json()) as { data?: unknown };
				const items =
					(data as { data?: Array<{ name?: unknown }> }).data?.filter(Boolean) ??
					[];

				return {
					items: items
						.map((p) => (typeof p?.name === "string" ? p.name : null))
						.filter((name): name is string => Boolean(name)),
				};
			}),

		get: authed
			.use(requiredAdminMiddleware)
			.input(type<{ name: string }>())
			.handler(async ({ input }) => {
				const url = new URL(
					`/api/public/v2/prompts/${encodeURIComponent(input.name)}`,
					env.LANGFUSE_BASEURL as string,
				);

				const res = await fetch(url, {
					method: "GET",
					headers: langfuseAuthHeaders(),
				});
				if (!res.ok) {
					throw new ORPCError("INTERNAL_SERVER_ERROR", {
						message: `Langfuse prompt fetch failed (${res.status})`,
					});
				}

				return (await res.json()) as unknown;
			}),
	},
};

