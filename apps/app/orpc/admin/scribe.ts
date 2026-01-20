import type { AnthropicProviderOptions } from "@ai-sdk/anthropic";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { ORPCError, streamToEventIterator, type } from "@orpc/server";
import { usageEvent } from "@repo/database";
import { env } from "@repo/env";
import { type ModelMessage, streamText } from "ai";
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
import type { PromptVariables } from "../scribe/types";

function todaysDateDE(): string {
	return new Date().toLocaleDateString("de-DE", {
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
	});
}

const compilePromptInput = z.object({
	documentType: z.string(),
	promptName: z.string().optional(),
	/**
	 * Preferred input: variables already shaped like `processedInput` in production.
	 */
	variables: z.record(z.unknown()).optional(),
	/**
	 * Convenience input: pass the raw prompt JSON (same as what AI Scribe sends),
	 * and we'll run the production `processInput` server-side for parity.
	 */
	promptJson: z.string().optional(),
});

const compilePromptHandler = authed
	.use(requiredAdminMiddleware)
	.input(type<z.infer<typeof compilePromptInput>>())
	.handler(async ({ input }) => {
		const parsed = compilePromptInput.parse(input);
		const config =
			documentTypeConfigs[
				parsed.documentType as keyof typeof documentTypeConfigs
			];
		if (!config) {
			throw new ORPCError("BAD_REQUEST", {
				message: `Unknown document type: ${parsed.documentType}`,
			});
		}

		const resolvedPromptName = parsed.promptName ?? config.promptName;

		const variablesUsed =
			parsed.variables ??
			(parsed.promptJson ? config.processInput(parsed.promptJson) : {});

		// Build prompt using local prompt function
		const promptVariables = {
			...variablesUsed,
			todaysDate: todaysDateDE(),
		} as PromptVariables;

		const compiledMessages = config.prompt(promptVariables);

		return {
			compiledMessages,
			resolvedPromptName,
			promptSource: "local",
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
			documentTypeConfigs[
				parsed.documentType as keyof typeof documentTypeConfigs
			];
		if (!config) {
			throw new ORPCError("BAD_REQUEST", {
				message: `Unknown document type: ${parsed.documentType}`,
			});
		}

		const resolvedPromptName = parsed.promptName ?? config.promptName;

		const variablesUsed =
			parsed.variables ??
			(parsed.promptJson ? config.processInput(parsed.promptJson) : {});

		const openrouter = createOpenRouter({
			apiKey: env.OPENROUTER_API_KEY as string,
		});
		const model = openrouter(parsed.model);

		const isClaudeModel = parsed.model.includes("anthropic") || parsed.model.includes("claude");
		const supportsThinking =
			isClaudeModel ||
			parsed.model.includes("glm") ||
			parsed.model.includes("gemini");

		const anthropicProviderOptions: AnthropicProviderOptions = {};
		if (parsed.parameters.thinking && supportsThinking && isClaudeModel) {
			anthropicProviderOptions.thinking = {
				type: "enabled",
				budgetTokens: parsed.parameters.thinkingBudget,
			};
		}

		let messages: ModelMessage[];
		if (parsed.compiledMessagesOverride) {
			messages = parsed.compiledMessagesOverride as unknown as ModelMessage[];
		} else {
			// Build prompt using local prompt function
			const promptVariables = {
				...variablesUsed,
				todaysDate: todaysDateDE(),
			} as PromptVariables;

			messages = config.prompt(promptVariables);
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
				openrouter: {
					usage: { include: true },
					user: context.session.user.email,
					reasoning: {
						enabled: true,
					},
				},
				...(isClaudeModel &&
					Object.keys(anthropicProviderOptions).length > 0 && {
						anthropic: anthropicProviderOptions,
					}),
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
							promptSource: "local",
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
				// Return all document type prompt names from local config
				const allPromptNames = Object.values(documentTypeConfigs).map(
					(config) => config.promptName,
				);

				// Filter by query if provided
				let filteredNames = allPromptNames;
				if (input.query && input.query.trim()) {
					const query = input.query.trim().toLowerCase();
					filteredNames = allPromptNames.filter((name) =>
						name.toLowerCase().includes(query),
					);
				}

			// Apply limit
				const limit = input.limit ?? 200;
				return {
					items: filteredNames.slice(0, limit),
				};
			}),

		get: authed
			.use(requiredAdminMiddleware)
			.input(type<{ name: string }>())
			.handler(async ({ input }) => {
				// Find the document type config by prompt name
				const entry = Object.entries(documentTypeConfigs).find(
					([_, config]) => config.promptName === input.name,
				);

				if (!entry) {
					throw new ORPCError("NOT_FOUND", {
						message: `Prompt not found: ${input.name}`,
					});
				}

				const [documentType, config] = entry;

				// Build sample messages to show the prompt structure
				const sampleVariables = {
					todaysDate: todaysDateDE(),
					anamnese: "[Anamnese]",
					befunde: "[Befunde]",
					diagnoseblock: "[Diagnoseblock]",
					notes: "[Notizen]",
					vordiagnosen: "[Vordiagnosen]",
					relevantTemplate: "[Relevante Vorlage]",
				} as PromptVariables;

				const messages = config.prompt(sampleVariables);

				return {
					name: config.promptName,
					documentType,
					source: "local",
					modelConfig: config.modelConfig,
					messages,
				};
			}),
	},
};
