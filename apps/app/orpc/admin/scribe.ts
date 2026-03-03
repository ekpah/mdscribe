import { ORPCError, streamToEventIterator, type } from "@orpc/server";
import { usageEvent } from "@repo/database";
import { streamText } from 'ai';
import type { ModelMessage } from 'ai';
import { z } from "zod";

import { buildUsageEventData, extractOpenRouterUsage } from '@/lib/usage-logging';
import type { StandardUsage, UsageInputData, UsageMetadata } from '@/lib/usage-logging';
import { authed } from "@/orpc";
import { requiredAdminMiddleware } from "../middlewares/admin";
import { documentTypeConfigs } from "../scribe/config";
import { buildScribeContext } from "../scribe/context";
import {
	resolveModelByRecordId,
	resolveProviderModel,
} from "../scribe/providers";
import type { PromptVariables } from "../scribe/types";

const todaysDateDE = (): string => {
	return new Date().toLocaleDateString("de-DE", {
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
	});
};

const compilePromptInput = z.object({
	documentType: z.string(),
	promptJson: z.string().optional(),
	promptName: z.string().optional(),
	variables: z.record(z.unknown()).optional(),
});

const parsePromptJson = (promptJson?: string): Record<string, unknown> => {
	if (!promptJson) {return {};}
	try {
		const parsed = JSON.parse(promptJson) as unknown;
		if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
			throw new Error("Invalid prompt JSON");
		}
		return parsed as Record<string, unknown>;
	} catch {
		throw new ORPCError("BAD_REQUEST", {
			message: "Invalid prompt JSON",
		});
	}
};

const compilePromptHandler = authed
	.use(requiredAdminMiddleware)
	.input(type<z.infer<typeof compilePromptInput>>())
	.handler(async ({ input, context }) => {
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
			parsed.variables ?? parsePromptJson(parsed.promptJson);
		if (
			parsed.documentType === "procedures" &&
			typeof variablesUsed.relevantTemplate !== "string"
		) {
			variablesUsed.relevantTemplate = "";
		}

		const { contextXml } = await buildScribeContext({
			sessionUser: context.session.user,
			sources: [{ data: variablesUsed, kind: "form" }],
		});

		const promptVariables = {
			...variablesUsed,
			contextXml,
			todaysDate: todaysDateDE(),
		} as PromptVariables;

		const compiledMessages = config.prompt(promptVariables);

		return {
			compiledMessages,
			promptSource: "local",
			resolvedPromptName,
			variablesUsed,
		};
	});

const runInput = z.object({
	compiledMessagesOverride: z
		.array(
			z.object({
				content: z.union([z.string(), z.array(z.unknown())]),
				role: z.enum(["system", "user", "assistant"]),
			}),
		)
		.optional(),
	// Backward compatibility while frontend payload migrates fully.
	connectionId: z.string().optional(),
	documentType: z.string(),
	model: z.string(),
	parameters: z.object({
		frequencyPenalty: z.number().min(-2).max(2).optional(),
		maxTokens: z.number().min(1).max(100_000).optional().default(4096),
		presencePenalty: z.number().min(-2).max(2).optional(),
		temperature: z.number().min(0).max(2).optional().default(1),
		thinking: z.boolean().optional().default(false),
		thinkingBudget: z.number().min(1000).max(50_000).optional().default(8000),
		thinkingExplicit: z.boolean().optional().default(false),
		topK: z.number().min(0).optional(),
		topP: z.number().min(0).max(1).optional(),
	}),
	promptJson: z.string().optional(),
	promptName: z.string().optional(),
	providerId: z.string().optional(),
	requestId: z.string(),
	variables: z.record(z.unknown()).optional(),
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
			parsed.variables ?? parsePromptJson(parsed.promptJson);
		if (
			parsed.documentType === "procedures" &&
			typeof variablesUsed.relevantTemplate !== "string"
		) {
			variablesUsed.relevantTemplate = "";
		}

		const providerId = parsed.providerId ?? parsed.connectionId;
		const resolved = providerId
			? await resolveProviderModel(providerId, parsed.model, context.db)
			: await resolveModelByRecordId(parsed.model, context.db);

		let messages: ModelMessage[];
		if (parsed.compiledMessagesOverride) {
			messages = parsed.compiledMessagesOverride as unknown as ModelMessage[];
		} else {
			const { contextXml } = await buildScribeContext({
				sessionUser: context.session.user,
				sources: [{ data: variablesUsed, kind: "form" }],
			});

			const promptVariables = {
				...variablesUsed,
				contextXml,
				todaysDate: todaysDateDE(),
			} as PromptVariables;

			messages = config.prompt(promptVariables);
		}

		const startTime = Date.now();
		const thinkingEnabled =
			parsed.parameters.thinking && resolved.supportsReasoning;
		const reasoningConfig = thinkingEnabled
			? { max_tokens: parsed.parameters.thinkingBudget }
			: undefined;

		const providerOptions = resolved.isOpenRouter
			? {
					openrouter: {
						usage: { include: true },
						user: context.session.user.email,
						...(reasoningConfig && {
							reasoning: reasoningConfig,
						}),
					},
				}
			: undefined;

		const result = streamText({
			frequencyPenalty: parsed.parameters.frequencyPenalty,
			maxOutputTokens: parsed.parameters.maxTokens,
			messages,
			model: resolved.model,
			onFinish: async (event) => {
				const latencyMs = Date.now() - startTime;
				const openRouterUsage = resolved.isOpenRouter
					? extractOpenRouterUsage(event.providerMetadata)
					: undefined;

				await context.db.insert(usageEvent).values(
					buildUsageEventData({
						inputData: variablesUsed as UsageInputData,
						metadata: {
							endpoint: parsed.documentType,
							latencyMs,
							modelConfig: {
								frequencyPenalty: parsed.parameters.frequencyPenalty,
								maxTokens: parsed.parameters.maxTokens,
								presencePenalty: parsed.parameters.presencePenalty,
								temperature: parsed.parameters.temperature,
								topK: parsed.parameters.topK,
								topP: parsed.parameters.topP,
							},
							promptName: resolvedPromptName,
							promptSource: "local",
							requestId: parsed.requestId,
							thinkingBudget: thinkingEnabled
								? parsed.parameters.thinkingBudget
								: undefined,
							thinkingEnabled,
						} as UsageMetadata,
						model: resolved.modelName,
						name: "admin_scribe_playground",
						openRouterUsage,
						reasoning: event.reasoningText,
						result: event.text,
						standardUsage: event.usage as StandardUsage,
						userId: context.session.user.id,
					}),
				);
			},
			presencePenalty: parsed.parameters.presencePenalty,
			providerOptions,
			temperature: parsed.parameters.temperature,
			topK: parsed.parameters.topK,
			topP: parsed.parameters.topP,
		});

		return streamToEventIterator(result.toUIMessageStream());
	});

export const scribeHandler = {
	compilePrompt: compilePromptHandler,
	prompts: {
			get: authed
				.use(requiredAdminMiddleware)
				.input(type<{ name: string }>())
				.handler(({ input }) => {
					const entry = Object.entries(documentTypeConfigs).find(
						([_, config]) => config.promptName === input.name,
					);

				if (!entry) {
					throw new ORPCError("NOT_FOUND", {
						message: `Prompt not found: ${input.name}`,
					});
				}

				const [documentType, config] = entry;

				const sampleVariables = {
					anamnese: "[Anamnese]",
					befunde: "[Befunde]",
					contextXml: "<patient_context></patient_context>",
					diagnoseblock: "[Diagnoseblock]",
					notes: "[Notizen]",
					relevantTemplate: "[Relevante Vorlage]",
					todaysDate: todaysDateDE(),
				} as PromptVariables;

				const messages = config.prompt(sampleVariables);

				return {
					documentType,
					messages,
					modelConfig: config.modelConfig,
					name: config.promptName,
					source: "local",
				};
			}),

			list: authed
				.use(requiredAdminMiddleware)
			.input(
				type<{
					query?: string;
					limit?: number;
				}>(),
			)
				.handler(({ input }) => {
					const allPromptNames = Object.values(documentTypeConfigs).map(
						(config) => config.promptName,
					);

				let filteredNames = allPromptNames;
				if (input.query?.trim()) {
					const query = input.query.trim().toLowerCase();
					filteredNames = allPromptNames.filter((name) =>
						name.toLowerCase().includes(query),
					);
				}

				const limit = input.limit ?? 200;
				return {
					items: filteredNames.slice(0, limit),
				};
			}),
	},
	run: runHandler,
};
